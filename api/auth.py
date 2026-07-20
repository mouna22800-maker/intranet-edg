import os
import datetime
from typing import Optional
import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, Cookie, Response
from dotenv import load_dotenv

# IMPORTANT : charger le .env AVANT de lire les variables ci-dessous. Ce module est importé très tôt
# (api.database l'importe pour hash_password), donc on ne peut pas compter sur un load_dotenv ailleurs.
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

_INSECURE_DEFAULT_SECRET = "edg-intranet-dev-secret-change-in-production"
SECRET_KEY = os.getenv("JWT_SECRET_KEY", _INSECURE_DEFAULT_SECRET)
ALGORITHM = "HS256"

# --- Session glissante : expire après 30 minutes d'INACTIVITÉ ---
# Le jeton est prolongé de 30 min à chaque requête authentifiée ; sans activité pendant 30 min, il expire.
SESSION_IDLE_MINUTES = 30

# --- Politique de mot de passe ---
PASSWORD_MIN_LENGTH = 12             # 12 caractères minimum
PASSWORD_SPECIAL_CHARS = "@$!%*?&#"  # caractères spéciaux acceptés (au moins un requis)
PASSWORD_MAX_AGE_DAYS = 90           # renouvellement obligatoire tous les 90 jours

# --- Blocage de compte (anti force-brute, par compte) ---
MAX_FAILED_ATTEMPTS = 5              # blocage après 5 échecs de connexion consécutifs
LOCKOUT_MINUTES = 15                 # durée pendant laquelle le compte reste bloqué

APP_ENV = os.getenv("APP_ENV", "development").lower()

# --- Session par cookie httpOnly (le jeton n'est jamais exposé au JavaScript => pas de vol par XSS) ---
SESSION_COOKIE_NAME = "edg_session"
# En production (HTTPS) : mettre COOKIE_SECURE=true. En dev local (HTTP), rester à false sinon le cookie n'est pas posé.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
# SameSite=Lax : le cookie n'est PAS envoyé sur les requêtes POST/PATCH/DELETE cross-site => protection CSRF.
COOKIE_SAMESITE = "lax"
COOKIE_MAX_AGE = SESSION_IDLE_MINUTES * 60

# Garde-fou : ne jamais tourner avec le secret par défaut public.
# En production (ou dès que le cookie Secure est activé), on refuse carrément de démarrer.
if SECRET_KEY == _INSECURE_DEFAULT_SECRET:
    if APP_ENV == "production" or COOKIE_SECURE:
        raise RuntimeError(
            "SÉCURITÉ : JWT_SECRET_KEY n'est pas défini. Générez un secret fort "
            "(ex: python -c \"import secrets; print(secrets.token_hex(32))\") et placez-le dans .env avant de démarrer en production."
        )
    print("\033[93m[AVERTISSEMENT SÉCURITÉ] JWT_SECRET_KEY absent : secret de développement non sécurisé utilisé. "
          "Définissez JWT_SECRET_KEY dans .env.\033[0m")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "name": user["name"],
        "unity_id": user.get("unity_id"),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=SESSION_IDLE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _token_from_claims(claims: dict) -> str:
    """Ré-émet un jeton à partir des revendications décodées, avec une nouvelle expiration (session glissante)."""
    payload = {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "role": claims.get("role"),
        "name": claims.get("name"),
        "unity_id": claims.get("unity_id"),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=SESSION_IDLE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def set_session_cookie(response: Response, token: str) -> None:
    """Pose le cookie de session httpOnly (fabrique unique, réutilisée à la connexion et au prolongement)."""
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def password_policy_error(password: str) -> Optional[str]:
    """
    Retourne un message d'erreur si le mot de passe ne respecte pas la politique de robustesse, sinon None.
    Politique : 12 caractères minimum, au moins une minuscule, une majuscule, un chiffre et un
    caractère spécial (@$!%*?&#), et aucun caractère accentué (é, ç, etc.).
    """
    if password is None or len(password) < PASSWORD_MIN_LENGTH:
        return f"Le mot de passe doit contenir au moins {PASSWORD_MIN_LENGTH} caractères."
    if not any(c.islower() for c in password):
        return "Le mot de passe doit contenir au moins une lettre minuscule."
    if not any(c.isupper() for c in password):
        return "Le mot de passe doit contenir au moins une lettre majuscule."
    if not any(c.isdigit() for c in password):
        return "Le mot de passe doit contenir au moins un chiffre."
    if not any(c in PASSWORD_SPECIAL_CHARS for c in password):
        return "Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&#)."
    if not password.isascii():
        return "Le mot de passe ne doit pas contenir de caractères accentués (é, ç, etc.)."
    return None


def is_password_expired(password_changed_at: Optional[str]) -> bool:
    """Vrai si le mot de passe a plus de PASSWORD_MAX_AGE_DAYS jours (renouvellement obligatoire)."""
    if not password_changed_at:
        return False  # inconnu : on ne force pas (évite de bloquer tout le monde par surprise)
    try:
        raw = str(password_changed_at).replace("T", " ")[:19]
        changed = datetime.datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return False
    return (datetime.datetime.utcnow() - changed).days >= PASSWORD_MAX_AGE_DAYS


def get_current_user(
    response: Response = None,
    authorization: str = Header(None),
    edg_session: str = Cookie(None)
) -> dict:
    """
    Dépendance FastAPI : exige une session valide, retourne le contenu décodé du jeton.
    Le jeton est lu en priorité depuis le cookie httpOnly `edg_session` (mécanisme principal),
    avec repli sur l'en-tête `Authorization: Bearer` (compatibilité / clients externes).

    Session GLISSANTE : à chaque requête authentifiée, le cookie est renouvelé pour 30 min.
    Sans aucune requête pendant 30 min, le jeton expire => déconnexion automatique pour inactivité.
    """
    token = None
    if edg_session:
        token = edg_session
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]

    if not token:
        raise HTTPException(status_code=401, detail="Authentification requise. Veuillez vous reconnecter.")
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée pour inactivité, veuillez vous reconnecter.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Jeton d'authentification invalide.")

    # Prolonge la session de 30 min (glissante). N'échoue jamais la requête si le renouvellement échoue.
    if response is not None:
        try:
            set_session_cookie(response, _token_from_claims(claims))
        except Exception:
            pass
    return claims


def require_role(*roles: str):
    """Fabrique de dépendance FastAPI : exige que l'utilisateur ait l'un des rôles fournis."""
    def _dependency(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Votre rôle ne permet pas cette action.")
        return user
    return _dependency


def can_write_department(user: dict, target_unity_id: Optional[int]) -> bool:
    """
    Détermine si `user` peut écrire une ressource rattachée à `target_unity_id`.
    - administrateur : toujours autorisé.
    - rh_direction sans direction (RH central) : toujours autorisé.
    - rh_direction avec direction (Directeur) ou chef_service : autorisé seulement sur sa propre direction.
    - agent : jamais autorisé (lecture seule).
    """
    role = user.get("role")
    if role == "administrateur":
        return True
    if role == "rh_direction" and user.get("unity_id") is None:
        return True
    if role in ("rh_direction", "chef_service"):
        user_unity_id = user.get("unity_id")
        return user_unity_id is not None and target_unity_id is not None and int(user_unity_id) == int(target_unity_id)
    return False


def require_write_department(target_unity_id: Optional[int], user: dict) -> None:
    """Lève une 403 si `user` n'est pas autorisé à écrire pour `target_unity_id`."""
    if not can_write_department(user, target_unity_id):
        raise HTTPException(status_code=403, detail="Cette action est réservée aux responsables de cette direction.")
