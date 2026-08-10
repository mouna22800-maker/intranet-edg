from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from api.database import get_db_connection
from api.models import PosteResponse, PosteCreate
from api.auth import get_current_user, require_role

router = APIRouter(
    prefix="/postes",
    tags=["postes"]
)

_SELECT = """
    SELECT p.id, p.title, p.unity_id, p.parent_id, p.occupant_name, p.occupant_email, p.ordre,
           u.label AS unity_label, u.code AS unity_code
    FROM poste p
    LEFT JOIN unity u ON p.unity_id = u.id
"""


def _row_to_poste(r):
    return {
        "id": r["id"],
        "title": r["title"],
        "unityId": r["unity_id"],
        "unityLabel": r["unity_label"] or "",
        "unityCode": r["unity_code"] or "",
        "parentId": r["parent_id"],
        "occupantName": r["occupant_name"] or "",
        "occupantEmail": r["occupant_email"] or "",
        "ordre": r["ordre"] if r["ordre"] is not None else 0,
    }


def _validate_refs(cursor, unity_id, parent_id):
    if unity_id is not None:
        cursor.execute("SELECT id FROM unity WHERE id = ?", (unity_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Direction de rattachement introuvable.")
    if parent_id is not None:
        cursor.execute("SELECT id FROM poste WHERE id = ?", (parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Poste parent introuvable.")


def _would_create_cycle(cursor, node_id, new_parent_id):
    """Remonte la chaîne de parents depuis new_parent : si on retombe sur node_id => cycle."""
    seen = set()
    cur = new_parent_id
    while cur is not None and cur not in seen:
        if cur == node_id:
            return True
        seen.add(cur)
        cursor.execute("SELECT parent_id FROM poste WHERE id = ?", (cur,))
        row = cursor.fetchone()
        cur = row["parent_id"] if row else None
    return False


@router.get("", response_model=List[PosteResponse])
def list_postes():
    """Sert l'organigramme : tous les postes/fonctions (lecture publique)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(_SELECT + " ORDER BY p.ordre, p.id")
        return [_row_to_poste(r) for r in cursor.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès aux postes: {str(e)}")
    finally:
        conn.close()


@router.post("", response_model=PosteResponse)
def create_poste(payload: PosteCreate, current: dict = Depends(require_role('administrateur', 'rh_direction'))):
    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="L'intitulé du poste est obligatoire.")
    unity_id = payload.unityId or None
    parent_id = payload.parentId or None

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        _validate_refs(cursor, unity_id, parent_id)
        cursor.execute(
            "INSERT INTO poste (title, unity_id, parent_id, occupant_name, occupant_email, ordre) VALUES (?, ?, ?, ?, ?, ?)",
            (title, unity_id, parent_id, (payload.occupantName or "").strip(), (payload.occupantEmail or "").strip(), payload.ordre or 0)
        )
        new_id = cursor.lastrowid
        conn.commit()
        cursor.execute(_SELECT + " WHERE p.id = ?", (new_id,))
        return _row_to_poste(cursor.fetchone())
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création du poste: {str(e)}")
    finally:
        conn.close()


@router.put("/{id}", response_model=PosteResponse)
def update_poste(id: int, payload: PosteCreate, current: dict = Depends(require_role('administrateur', 'rh_direction'))):
    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="L'intitulé du poste est obligatoire.")
    unity_id = payload.unityId or None
    parent_id = payload.parentId or None
    if parent_id == id:
        raise HTTPException(status_code=400, detail="Un poste ne peut pas être son propre parent.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM poste WHERE id = ?", (id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Poste introuvable.")
        _validate_refs(cursor, unity_id, parent_id)
        if parent_id is not None and _would_create_cycle(cursor, id, parent_id):
            raise HTTPException(status_code=400, detail="Rattachement impossible : cela créerait une boucle dans l'organigramme.")
        cursor.execute(
            "UPDATE poste SET title = ?, unity_id = ?, parent_id = ?, occupant_name = ?, occupant_email = ?, ordre = ? WHERE id = ?",
            (title, unity_id, parent_id, (payload.occupantName or "").strip(), (payload.occupantEmail or "").strip(), payload.ordre or 0, id)
        )
        conn.commit()
        cursor.execute(_SELECT + " WHERE p.id = ?", (id,))
        return _row_to_poste(cursor.fetchone())
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour du poste: {str(e)}")
    finally:
        conn.close()


@router.delete("/{id}")
def delete_poste(id: int, current: dict = Depends(require_role('administrateur', 'rh_direction'))):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM poste WHERE id = ?", (id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Poste introuvable.")
        # Les postes enfants remontent à la racine (indépendant du support ON DELETE SET NULL de SQLite).
        cursor.execute("UPDATE poste SET parent_id = NULL WHERE parent_id = ?", (id,))
        cursor.execute("DELETE FROM poste WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Poste supprimé"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression du poste: {str(e)}")
    finally:
        conn.close()
