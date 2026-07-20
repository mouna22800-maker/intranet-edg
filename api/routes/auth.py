import os
import time
import hashlib
import secrets
import datetime
import jwt
from fastapi import APIRouter, HTTPException, Response, Depends, Request, Cookie
from api.database import get_db_connection
from api.email_util import send_email
from api.auth import (
    verify_password, create_access_token, get_current_user, hash_password,
    set_session_cookie, password_policy_error, is_password_expired, require_role,
    SESSION_COOKIE_NAME, SECRET_KEY, ALGORITHM,
    MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES,
)
from api.models import LoginRequest, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest

RESET_TOKEN_TTL_MINUTES = 60


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

# --- Anti force brute NIVEAU IP (limiteur en mémoire) : garde-fou secondaire contre le balayage
# multi-comptes depuis une même IP. Le blocage PRINCIPAL est par compte (5 échecs -> 423), en base.
# NOTE : en mémoire = par processus ; pour un déploiement multi-workers, déporter vers Redis.
_LOGIN_WINDOW_SECONDS = 15 * 60      # fenêtre glissante de 15 minutes
_LOGIN_MAX_FAILURES = 20             # tolérance IP large (le blocage par compte agit bien avant)
_login_failures: dict = {}           # ip -> [timestamps des échecs]


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _enforce_login_rate_limit(ip: str) -> None:
    now = time.time()
    attempts = [t for t in _login_failures.get(ip, []) if now - t < _LOGIN_WINDOW_SECONDS]
    _login_failures[ip] = attempts
    if len(attempts) >= _LOGIN_MAX_FAILURES:
        retry = int(_LOGIN_WINDOW_SECONDS - (now - attempts[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Trop de tentatives de connexion échouées. Réessayez dans {retry // 60 + 1} minute(s).",
            headers={"Retry-After": str(max(retry, 1))},
        )


def _record_login_failure(ip: str) -> None:
    _login_failures.setdefault(ip, []).append(time.time())


def _clear_login_failures(ip: str) -> None:
    _login_failures.pop(ip, None)


# --- Utilitaires de date (stockage ISO, comparaisons en Python => indépendant du SGBD) ---
def _parse_iso(value) -> datetime.datetime:
    if not value:
        return None
    try:
        return datetime.datetime.strptime(str(value).replace("T", " ")[:19], "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return None


def _is_locked(locked_until) -> bool:
    dt = _parse_iso(locked_until)
    return dt is not None and dt > datetime.datetime.utcnow()


def _lock_remaining_minutes(locked_until) -> int:
    dt = _parse_iso(locked_until)
    if not dt:
        return LOCKOUT_MINUTES
    return max(1, int((dt - datetime.datetime.utcnow()).total_seconds() // 60) + 1)


def _audit(conn, user_id, email, event_type, request) -> None:
    """Enregistre un événement de sécurité. Le commit est à la charge de l'appelant. Ne lève jamais."""
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO auth_audit_log (user_id, email, event_type, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, email, event_type, _client_ip(request),
             (request.headers.get("user-agent") or "")[:400], datetime.datetime.utcnow().isoformat()),
        )
    except Exception:
        pass


def _user_dict_from_row(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "departmentId": row["unity_id"],
        "departmentName": row["department_name"] or "",
        "departmentCode": row["department_code"] or "",
        "title": row["title"] or ""
    }


@router.post("/login")
def login(payload: LoginRequest, response: Response, request: Request):
    """
    Vérifie les identifiants et ouvre une session (cookie httpOnly `edg_session`, jamais exposé au JS).
    Sécurité : blocage du compte après 5 échecs consécutifs (423), journal d'audit, mise à jour de la
    dernière connexion, et signal `mustChangePassword` si le mot de passe a dépassé 90 jours.
    """
    email = payload.email.strip().lower()
    ip = _client_ip(request)
    _enforce_login_rate_limit(ip)  # garde-fou IP secondaire

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, email, password_hash, role, unity_id, department_name, department_code, title, "
            "failed_login_attempts, locked_until, password_changed_at, must_change_password FROM users WHERE email = ?",
            (email,)
        )
        row = cursor.fetchone()

        # Compte inexistant : message générique (ne révèle pas l'absence du compte).
        if not row:
            _record_login_failure(ip)
            _audit(conn, None, email, "login_failed", request)
            conn.commit()
            raise HTTPException(status_code=401, detail="E-mail ou mot de passe incorrect.")

        user_id = row["id"]

        # Compte déjà bloqué ?
        if _is_locked(row["locked_until"]):
            _audit(conn, user_id, email, "login_blocked", request)
            conn.commit()
            mins = _lock_remaining_minutes(row["locked_until"])
            raise HTTPException(status_code=423, detail=f"Compte temporairement bloqué. Réessayez dans {mins} minute(s).")

        # Mot de passe erroné : incrémente le compteur, bloque au 5e échec.
        if not verify_password(payload.password, row["password_hash"]):
            attempts = (row["failed_login_attempts"] or 0) + 1
            _record_login_failure(ip)
            if attempts >= MAX_FAILED_ATTEMPTS:
                locked_until = (datetime.datetime.utcnow() + datetime.timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
                cursor.execute("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
                               (attempts, locked_until, user_id))
                _audit(conn, user_id, email, "account_locked", request)
                conn.commit()
                raise HTTPException(
                    status_code=423,
                    detail=f"Compte bloqué après {MAX_FAILED_ATTEMPTS} tentatives échouées. Réessayez dans {LOCKOUT_MINUTES} minutes."
                )
            cursor.execute("UPDATE users SET failed_login_attempts = ? WHERE id = ?", (attempts, user_id))
            _audit(conn, user_id, email, "login_failed", request)
            conn.commit()
            remaining = MAX_FAILED_ATTEMPTS - attempts
            raise HTTPException(
                status_code=401,
                detail=f"E-mail ou mot de passe incorrect. {remaining} tentative(s) restante(s) avant blocage du compte."
            )

        # Succès : réinitialise le compteur, débloque, met à jour la dernière connexion.
        now_iso = datetime.datetime.utcnow().isoformat()
        cursor.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?",
                       (now_iso, user_id))
        _clear_login_failures(ip)
        _audit(conn, user_id, email, "login_success", request)
        conn.commit()

        user = _user_dict_from_row(row)
        # 'initial' = compte créé/réinitialisé par l'admin (activation) ; 'expired' = renouvellement après 90 jours.
        reason = "initial" if bool(row["must_change_password"]) else ("expired" if is_password_expired(row["password_changed_at"]) else None)
        must_change = reason is not None
        user["mustChangePassword"] = must_change
        user["passwordChangeReason"] = reason
        token = create_access_token({
            "id": row["id"], "email": row["email"], "role": row["role"],
            "name": row["name"], "unity_id": row["unity_id"]
        })
        set_session_cookie(response, token)
        return {"status": "success", "user": user, "mustChangePassword": must_change, "passwordChangeReason": reason}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur d'authentification : {str(e)}")
    finally:
        conn.close()


@router.post("/logout")
def logout(response: Response, request: Request, edg_session: str = Cookie(None)):
    """Ferme la session (supprime le cookie) et enregistre la déconnexion au journal d'audit."""
    user_id, email = None, None
    if edg_session:
        try:
            claims = jwt.decode(edg_session, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = int(claims.get("sub")) if claims.get("sub") else None
            email = claims.get("email")
        except Exception:
            pass
    conn = get_db_connection()
    try:
        _audit(conn, user_id, email, "logout", request)
        conn.commit()
    finally:
        conn.close()
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"status": "success"}


@router.get("/me")
def me(current: dict = Depends(get_current_user)):
    """
    Restaure la session côté client (au démarrage / rafraîchissement) : renvoie le profil complet
    associé au cookie de session, plus le signal `mustChangePassword` (401 si aucune session valide).
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, email, role, unity_id, department_name, department_code, title, password_changed_at, must_change_password "
            "FROM users WHERE id = ?",
            (int(current.get("sub")),)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Session invalide.")
        user = _user_dict_from_row(row)
        reason = "initial" if bool(row["must_change_password"]) else ("expired" if is_password_expired(row["password_changed_at"]) else None)
        must_change = reason is not None
        user["mustChangePassword"] = must_change
        user["passwordChangeReason"] = reason
        return {"status": "success", "user": user, "mustChangePassword": must_change, "passwordChangeReason": reason}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur de restauration de session : {str(e)}")
    finally:
        conn.close()


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, request: Request, current: dict = Depends(get_current_user)):
    """
    Change le mot de passe de l'utilisateur connecté (utilisé aussi pour le renouvellement forcé à 90 jours).
    Applique la politique : 8 caractères minimum, différent de l'ancien, mot de passe actuel exigé.
    """
    policy_err = password_policy_error(payload.newPassword)
    if policy_err:
        raise HTTPException(status_code=400, detail=policy_err)

    user_id = int(current.get("sub"))
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT email, password_hash FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Session invalide.")

        if not verify_password(payload.currentPassword, row["password_hash"]):
            _audit(conn, user_id, row["email"], "password_change_failed", request)
            conn.commit()
            raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")

        if verify_password(payload.newPassword, row["password_hash"]):
            raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit être différent de l'ancien.")

        now_iso = datetime.datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE users SET password_hash = ?, password_changed_at = ?, failed_login_attempts = 0, locked_until = NULL, must_change_password = 0 WHERE id = ?",
            (hash_password(payload.newPassword), now_iso, user_id)
        )
        _audit(conn, user_id, row["email"], "password_changed", request)
        conn.commit()
        return {"status": "success", "message": "Mot de passe mis à jour."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors du changement de mot de passe : {str(e)}")
    finally:
        conn.close()


@router.get("/audit")
def audit_log(limit: int = 100, current: dict = Depends(require_role("administrateur"))):
    """Journal d'audit de sécurité (connexions, déconnexions, blocages, changements de mot de passe). Admin uniquement."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, email, event_type, ip, user_agent, created_at "
            "FROM auth_audit_log ORDER BY id DESC LIMIT ?",
            (min(max(limit, 1), 500),)
        )
        rows = cursor.fetchall()
        data = [{
            "id": r["id"],
            "userId": r["user_id"],
            "email": r["email"],
            "event": r["event_type"],
            "ip": r["ip"],
            "userAgent": r["user_agent"],
            "at": r["created_at"],
        } for r in rows]
        return {"status": "success", "data": data}
    finally:
        conn.close()


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request):
    """
    Démarre une réinitialisation : envoie un lien par e-mail SI le compte existe.
    La réponse est toujours identique (ne révèle pas si l'e-mail existe).
    """
    email = payload.email.strip().lower()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            token = secrets.token_urlsafe(32)
            expires = (datetime.datetime.utcnow() + datetime.timedelta(minutes=RESET_TOKEN_TTL_MINUTES)).isoformat()
            cursor.execute("UPDATE users SET reset_token_hash = ?, reset_expires = ? WHERE id = ?",
                           (_hash_token(token), expires, row["id"]))
            _audit(conn, row["id"], email, "password_reset_requested", request)
            conn.commit()

            app_url = os.getenv("APP_URL", "http://localhost:3000").rstrip("/")
            reset_link = f"{app_url}/#reset/{token}"
            first_name = (row["name"] or "").split(" ")[0]
            subject = "Réinitialisation de votre mot de passe — Intranet EDG"
            html = (
                f"<p>Bonjour {first_name},</p>"
                f"<p>Vous avez demandé la réinitialisation de votre mot de passe sur l'intranet de l'Électricité de Guinée.</p>"
                f'<p><a href="{reset_link}" style="background:#048343;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Réinitialiser mon mot de passe</a></p>'
                f"<p>Ou copiez ce lien : {reset_link}</p>"
                f"<p>Ce lien expire dans {RESET_TOKEN_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>"
                f"<p>— Électricité de Guinée</p>"
            )
            text = f"Réinitialisez votre mot de passe : {reset_link} (valable {RESET_TOKEN_TTL_MINUTES} minutes)."
            send_email(email, subject, html, text)
        return {"status": "success", "message": "Si un compte existe pour cette adresse, un e-mail de réinitialisation a été envoyé."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la demande : {str(e)}")
    finally:
        conn.close()


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, request: Request):
    """Finalise la réinitialisation via le jeton reçu par e-mail (applique la politique de mot de passe)."""
    policy_err = password_policy_error(payload.newPassword)
    if policy_err:
        raise HTTPException(status_code=400, detail=policy_err)

    token_hash = _hash_token(payload.token.strip())
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, reset_expires FROM users WHERE reset_token_hash = ?", (token_hash,))
        row = cursor.fetchone()
        expires_dt = _parse_iso(row["reset_expires"]) if row else None
        if not row or expires_dt is None or expires_dt < datetime.datetime.utcnow():
            raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide ou expiré.")

        now_iso = datetime.datetime.utcnow().isoformat()
        cursor.execute(
            "UPDATE users SET password_hash = ?, password_changed_at = ?, must_change_password = 0, "
            "reset_token_hash = NULL, reset_expires = NULL, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
            (hash_password(payload.newPassword), now_iso, row["id"])
        )
        _audit(conn, row["id"], row["email"], "password_reset_done", request)
        conn.commit()
        return {"status": "success", "message": "Mot de passe réinitialisé. Vous pouvez vous connecter."}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la réinitialisation : {str(e)}")
    finally:
        conn.close()
