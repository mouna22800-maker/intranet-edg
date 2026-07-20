import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from api.database import get_db_connection, create_user_notification
from api.models import UserAccountResponse, UserAccountCreate, UserAccountUpdate, PaginatedUsers
from api.auth import require_role, hash_password

router = APIRouter(
    prefix="/admin/users",
    tags=["users"]
)

VALID_ROLES = {"agent", "chef_service", "rh_direction", "administrateur"}


def _validate_role_department(role: str, department_id: Optional[int]) -> None:
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Rôle invalide.")
    if role in ("agent", "chef_service") and department_id is None:
        raise HTTPException(status_code=400, detail="Une direction de rattachement est obligatoire pour ce rôle.")
    if role == "administrateur" and department_id is not None:
        raise HTTPException(status_code=400, detail="Un administrateur ne peut pas être rattaché à une direction.")


def _unity_row(cursor, unity_id: Optional[int]):
    if unity_id is None:
        return None
    cursor.execute("SELECT id, label, code FROM unity WHERE id = ?", (unity_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="Direction introuvable.")
    return row


def _row_to_user(r):
    return {
        "id": r["id"],
        "name": r["name"],
        "email": r["email"],
        "role": r["role"],
        "departmentId": r["unity_id"],
        "departmentLabel": r["unity_label"] or "",
        "title": r["title"] or ""
    }


@router.get("", response_model=PaginatedUsers)
def list_users(
    search: Optional[str] = Query(None, description="Recherche sur le nom ou l'email"),
    role: Optional[str] = Query(None, description="Filtrer par rôle"),
    department_id: Optional[int] = Query(None, description="Filtrer par direction (unity_id)"),
    page: int = Query(1, ge=1, description="Numéro de page (1-indexé)"),
    page_size: int = Query(20, ge=1, le=100, description="Nombre de comptes par page"),
    current_user: dict = Depends(require_role('administrateur'))
):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        where = "WHERE 1=1"
        params = []
        if search and search.strip():
            where += " AND (u.name LIKE ? OR u.email LIKE ?)"
            like = f"%{search.strip()}%"
            params += [like, like]
        if role:
            where += " AND u.role = ?"
            params.append(role)
        if department_id is not None:
            where += " AND u.unity_id = ?"
            params.append(department_id)

        cursor.execute(f"SELECT COUNT(*) as cnt FROM users u {where}", params)
        res = cursor.fetchone()
        total = res["cnt"] if isinstance(res, dict) else res[0]

        offset = (page - 1) * page_size
        cursor.execute(f"""
            SELECT u.id, u.name, u.email, u.role, u.unity_id, u.title, un.label as unity_label
            FROM users u
            LEFT JOIN unity un ON u.unity_id = un.id
            {where}
            ORDER BY u.name
            LIMIT ? OFFSET ?
        """, params + [page_size, offset])
        items = [_row_to_user(r) for r in cursor.fetchall()]
        return {"items": items, "total": total, "page": page, "pageSize": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès aux comptes: {str(e)}")
    finally:
        conn.close()


@router.post("", response_model=UserAccountResponse)
def create_user(payload: UserAccountCreate, current_user: dict = Depends(require_role('administrateur'))):
    _validate_role_department(payload.role, payload.departmentId)
    # Mot de passe TEMPORAIRE choisi par l'admin : il peut être simple, voire un mot de passe par défaut.
    # Les exigences de robustesse (majuscule, chiffre…) ne s'appliquent PAS ici : elles s'imposent à
    # l'UTILISATEUR quand il définit son propre mot de passe à sa première connexion (must_change_password).
    # On exige seulement que le mot de passe temporaire ne soit pas vide.
    if not payload.password or not payload.password.strip():
        raise HTTPException(status_code=400, detail="Un mot de passe temporaire est requis.")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        unity_row = _unity_row(cursor, payload.departmentId)

        clean_email = payload.email.strip().lower()
        cursor.execute("SELECT id FROM users WHERE email = ?", (clean_email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email.")

        # Compte créé par l'admin : mot de passe TEMPORAIRE, l'utilisateur devra le changer à sa 1re connexion.
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, unity_id, department_name, department_code, title, password_changed_at, must_change_password)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            payload.name.strip(), clean_email, hash_password(payload.password), payload.role,
            payload.departmentId,
            unity_row["label"] if unity_row else "",
            unity_row["code"] if unity_row else "",
            (payload.title or "").strip(),
            datetime.datetime.utcnow().isoformat()
        ))
        new_id = cursor.lastrowid

        cursor.execute("SELECT id FROM users WHERE role = 'administrateur' AND id NOT IN (?, ?)", (int(current_user.get("sub")), new_id))
        for row in cursor.fetchall():
            create_user_notification(
                cursor, row["id"], 'account_new',
                "Nouveau compte créé",
                f"{payload.name.strip()} ({payload.role}) a été ajouté par {current_user.get('name')}."
            )

        conn.commit()
        return {
            "id": new_id,
            "name": payload.name.strip(),
            "email": clean_email,
            "role": payload.role,
            "departmentId": payload.departmentId,
            "departmentLabel": unity_row["label"] if unity_row else "",
            "title": (payload.title or "").strip()
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création du compte: {str(e)}")
    finally:
        conn.close()


@router.put("/{id}", response_model=UserAccountResponse)
def update_user(id: int, payload: UserAccountUpdate, current_user: dict = Depends(require_role('administrateur'))):
    _validate_role_department(payload.role, payload.departmentId)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email FROM users WHERE id = ?", (id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Compte introuvable.")

        unity_row = _unity_row(cursor, payload.departmentId)

        clean_email = payload.email.strip().lower()
        cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", (clean_email, id))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Un autre compte utilise déjà cet email.")

        if payload.password:
            # Réinitialisation par l'admin : mot de passe temporaire simple autorisé ; l'utilisateur devra
            # en choisir un conforme (fort) à sa prochaine connexion (must_change_password = 1).
            if not payload.password.strip():
                raise HTTPException(status_code=400, detail="Le mot de passe temporaire ne peut pas être vide.")
            cursor.execute("""
                UPDATE users
                SET name = ?, email = ?, role = ?, unity_id = ?, department_name = ?, department_code = ?, title = ?, password_hash = ?, password_changed_at = ?, must_change_password = 1
                WHERE id = ?
            """, (
                payload.name.strip(), clean_email, payload.role, payload.departmentId,
                unity_row["label"] if unity_row else "", unity_row["code"] if unity_row else "",
                (payload.title or "").strip(), hash_password(payload.password),
                datetime.datetime.utcnow().isoformat(), id
            ))
        else:
            cursor.execute("""
                UPDATE users
                SET name = ?, email = ?, role = ?, unity_id = ?, department_name = ?, department_code = ?, title = ?
                WHERE id = ?
            """, (
                payload.name.strip(), clean_email, payload.role, payload.departmentId,
                unity_row["label"] if unity_row else "", unity_row["code"] if unity_row else "",
                (payload.title or "").strip(), id
            ))
        conn.commit()
        return {
            "id": id,
            "name": payload.name.strip(),
            "email": clean_email,
            "role": payload.role,
            "departmentId": payload.departmentId,
            "departmentLabel": unity_row["label"] if unity_row else "",
            "title": (payload.title or "").strip()
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour du compte: {str(e)}")
    finally:
        conn.close()


@router.delete("/{id}")
def delete_user(id: int, current_user: dict = Depends(require_role('administrateur'))):
    if str(current_user.get("sub")) == str(id):
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte.")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", (id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Compte introuvable.")
        cursor.execute("DELETE FROM users WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Compte supprimé"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression du compte: {str(e)}")
    finally:
        conn.close()
