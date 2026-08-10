"""
Organigrammes / circuits dynamiques et contextuels.

Modèle :
  - unity              : les entités (Direction, Département, Service…), indépendantes et réutilisables.
  - workflow           : les contextes ("Organigramme Général", "Validation Application"…).
  - organigramme_node  : place une entité DANS un workflow, avec SON parent DANS ce workflow.
                         La même entité peut donc avoir un parent différent selon le workflow.
"""
import re
import unicodedata
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from api.database import get_db_connection
from api.models import (
    WorkflowResponse, WorkflowCreate, NodeCreate, NodeUpdate, NodeResponse,
    UnitEntity, UnitEntityCreate,
)
from api.auth import get_current_user, require_role

router = APIRouter(prefix="/workflows", tags=["workflows"])

_manage = require_role('administrateur', 'rh_direction')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _slugify(text: str) -> str:
    norm = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode('ascii')
    norm = re.sub(r'[^a-zA-Z0-9]+', '_', norm).strip('_').lower()
    return norm or 'entite'


def _unique_code(cursor, base: str) -> str:
    code = base
    i = 2
    while True:
        cursor.execute("SELECT id FROM unity WHERE code = ?", (code,))
        if not cursor.fetchone():
            return code
        code = f"{base}_{i}"
        i += 1


def _row_val(row, key, idx):
    return (row[key] if isinstance(row, dict) else row[idx]) if row else None


# ---------------------------------------------------------------------------
# Entités (unity) — liste maître réutilisable par tous les workflows
# ---------------------------------------------------------------------------
@router.get("/entities", response_model=List[UnitEntity])
def list_entities():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, code, label AS name, type FROM unity ORDER BY type, label")
        return [
            {"id": r["id"], "code": r["code"], "name": r["name"], "type": r["type"] or "Direction"}
            for r in cursor.fetchall()
        ]
    finally:
        conn.close()


@router.post("/entities", response_model=UnitEntity)
def create_entity(payload: UnitEntityCreate, current: dict = Depends(_manage)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Le nom de l'entité est obligatoire.")
    node_type = (payload.type or "Département").strip() or "Département"
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        code = (payload.code or "").strip() or _slugify(name)
        code = _unique_code(cursor, code)
        # director_name est NOT NULL sur unity : on met une chaîne vide pour une entité "structurelle".
        cursor.execute(
            "INSERT INTO unity (label, code, type, director_name) VALUES (?, ?, ?, '')",
            (name, code, node_type)
        )
        new_id = cursor.lastrowid
        conn.commit()
        return {"id": new_id, "code": code, "name": name, "type": node_type}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de l'entité: {str(e)}")
    finally:
        conn.close()


@router.put("/entities/{unit_id}", response_model=UnitEntity)
def update_entity(unit_id: int, payload: UnitEntityCreate, current: dict = Depends(_manage)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Le nom de l'entité est obligatoire.")
    node_type = (payload.type or "Département").strip() or "Département"
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM unity WHERE id = ?", (unit_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Entité introuvable.")
        cursor.execute("UPDATE unity SET label = ?, type = ? WHERE id = ?", (name, node_type, unit_id))
        conn.commit()
        cursor.execute("SELECT id, code, label AS name, type FROM unity WHERE id = ?", (unit_id,))
        r = cursor.fetchone()
        return {"id": r["id"], "code": r["code"], "name": r["name"], "type": r["type"] or "Direction"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")
    finally:
        conn.close()


@router.delete("/entities/{unit_id}")
def delete_entity(unit_id: int, current: dict = Depends(_manage)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM unity WHERE id = ?", (unit_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Entité introuvable.")
        # Refus si l'entité porte du contenu (actus/documents…) rattaché : on ne casse pas les données métier.
        for table in ("content", "documents", "tickets", "team_members"):
            try:
                cursor.execute(f"SELECT COUNT(*) AS c FROM {table} WHERE unity_id = ?", (unit_id,))
                cnt = _row_val(cursor.fetchone(), "c", 0) or 0
                if cnt:
                    raise HTTPException(status_code=400, detail="Impossible de supprimer : cette entité porte du contenu (actualités, documents…). Videz-la d'abord.")
            except HTTPException:
                raise
            except Exception:
                pass  # table absente ou sans colonne unity_id : on ignore
        cursor.execute("DELETE FROM unity WHERE id = ?", (unit_id,))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Workflows (contextes d'organigramme)
# ---------------------------------------------------------------------------
@router.get("", response_model=List[WorkflowResponse])
def list_workflows():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, label, description FROM workflow ORDER BY id")
        return [{"id": r["id"], "label": r["label"], "description": r["description"] or ""} for r in cursor.fetchall()]
    finally:
        conn.close()


@router.post("", response_model=WorkflowResponse)
def create_workflow(payload: WorkflowCreate, current: dict = Depends(_manage)):
    label = (payload.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Le nom de l'organigramme est obligatoire.")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO workflow (label, description) VALUES (?, ?)", (label, (payload.description or "").strip()))
        new_id = cursor.lastrowid
        conn.commit()
        return {"id": new_id, "label": label, "description": (payload.description or "").strip()}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de l'organigramme: {str(e)}")
    finally:
        conn.close()


@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(workflow_id: int, payload: WorkflowCreate, current: dict = Depends(_manage)):
    label = (payload.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Le nom de l'organigramme est obligatoire.")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM workflow WHERE id = ?", (workflow_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Organigramme introuvable.")
        cursor.execute("UPDATE workflow SET label = ?, description = ? WHERE id = ?", (label, (payload.description or "").strip(), workflow_id))
        conn.commit()
        return {"id": workflow_id, "label": label, "description": (payload.description or "").strip()}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")
    finally:
        conn.close()


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: int, current: dict = Depends(_manage)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM workflow WHERE id = ?", (workflow_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Organigramme introuvable.")
        # Suppression explicite des nœuds (SQLite peut ne pas appliquer ON DELETE CASCADE).
        cursor.execute("DELETE FROM organigramme_node WHERE workflow_id = ?", (workflow_id,))
        cursor.execute("DELETE FROM workflow WHERE id = ?", (workflow_id,))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Nœuds d'un workflow (placement contextuel des entités)
# ---------------------------------------------------------------------------
_NODE_SELECT = """
    SELECT n.id, n.workflow_id, n.unit_id, n.parent_unit_id, n.ordre,
           u.label AS name, u.code AS code, u.type AS type
    FROM organigramme_node n
    JOIN unity u ON u.id = n.unit_id
    WHERE n.workflow_id = ?
"""


def _node_row(r):
    return {
        "id": r["id"],
        "workflowId": r["workflow_id"],
        "unitId": r["unit_id"],
        "parentUnitId": r["parent_unit_id"],
        "ordre": r["ordre"] if r["ordre"] is not None else 0,
        "name": r["name"],
        "code": r["code"],
        "type": r["type"] or "Direction",
    }


def _require_workflow(cursor, workflow_id):
    cursor.execute("SELECT id FROM workflow WHERE id = ?", (workflow_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Organigramme introuvable.")


def _units_in_workflow(cursor, workflow_id):
    """Renvoie {unit_id: parent_unit_id} pour tous les nœuds du workflow."""
    cursor.execute("SELECT unit_id, parent_unit_id FROM organigramme_node WHERE workflow_id = ?", (workflow_id,))
    return {r["unit_id"]: r["parent_unit_id"] for r in cursor.fetchall()}


def _would_create_cycle(parents_by_unit, unit_id, new_parent_unit_id):
    """Remonte la chaîne de parents (dans ce workflow) : si on retombe sur unit_id => cycle."""
    seen = set()
    cur = new_parent_unit_id
    while cur is not None and cur not in seen:
        if cur == unit_id:
            return True
        seen.add(cur)
        cur = parents_by_unit.get(cur)
    return False


@router.get("/{workflow_id}/nodes", response_model=List[NodeResponse])
def list_nodes(workflow_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        _require_workflow(cursor, workflow_id)
        cursor.execute(_NODE_SELECT + " ORDER BY n.ordre, n.id", (workflow_id,))
        return [_node_row(r) for r in cursor.fetchall()]
    finally:
        conn.close()


@router.get("/{workflow_id}/tree")
def workflow_tree(workflow_id: int):
    """Arbre hiérarchique récursif (nested) des entités pour ce workflow (lecture publique)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        _require_workflow(cursor, workflow_id)
        cursor.execute(_NODE_SELECT + " ORDER BY n.ordre, n.id", (workflow_id,))
        nodes = [_node_row(r) for r in cursor.fetchall()]

        by_unit = {n["unitId"]: {**n, "children": []} for n in nodes}
        roots = []
        for n in nodes:
            node = by_unit[n["unitId"]]
            parent_uid = n["parentUnitId"]
            if parent_uid is not None and parent_uid in by_unit:
                by_unit[parent_uid]["children"].append(node)
            else:
                roots.append(node)
        return {"workflowId": workflow_id, "tree": roots}
    finally:
        conn.close()


@router.post("/{workflow_id}/nodes", response_model=NodeResponse)
def add_node(workflow_id: int, payload: NodeCreate, current: dict = Depends(_manage)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        _require_workflow(cursor, workflow_id)

        cursor.execute("SELECT id FROM unity WHERE id = ?", (payload.unitId,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Entité introuvable.")

        existing = _units_in_workflow(cursor, workflow_id)
        if payload.unitId in existing:
            raise HTTPException(status_code=400, detail="Cette entité est déjà présente dans cet organigramme.")

        parent_uid = payload.parentUnitId or None
        if parent_uid is not None:
            if parent_uid == payload.unitId:
                raise HTTPException(status_code=400, detail="Une entité ne peut pas être son propre parent.")
            if parent_uid not in existing:
                raise HTTPException(status_code=400, detail="Le parent choisi n'appartient pas à cet organigramme.")

        cursor.execute(
            "INSERT INTO organigramme_node (workflow_id, unit_id, parent_unit_id, ordre) VALUES (?, ?, ?, ?)",
            (workflow_id, payload.unitId, parent_uid, payload.ordre or 0)
        )
        new_id = cursor.lastrowid
        conn.commit()
        cursor.execute(_NODE_SELECT + " AND n.id = ?", (workflow_id, new_id))
        return _node_row(cursor.fetchone())
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'ajout: {str(e)}")
    finally:
        conn.close()


@router.put("/{workflow_id}/nodes/{node_id}", response_model=NodeResponse)
def update_node(workflow_id: int, node_id: int, payload: NodeUpdate, current: dict = Depends(_manage)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        _require_workflow(cursor, workflow_id)
        cursor.execute("SELECT unit_id FROM organigramme_node WHERE id = ? AND workflow_id = ?", (node_id, workflow_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Nœud introuvable dans cet organigramme.")
        unit_id = row["unit_id"] if isinstance(row, dict) else row[0]

        parent_uid = payload.parentUnitId or None
        if parent_uid is not None:
            if parent_uid == unit_id:
                raise HTTPException(status_code=400, detail="Une entité ne peut pas être son propre parent.")
            existing = _units_in_workflow(cursor, workflow_id)
            if parent_uid not in existing:
                raise HTTPException(status_code=400, detail="Le parent choisi n'appartient pas à cet organigramme.")
            existing[unit_id] = None  # on simule le déplacement pour tester le cycle
            if _would_create_cycle(existing, unit_id, parent_uid):
                raise HTTPException(status_code=400, detail="Rattachement impossible : cela créerait une boucle.")

        cursor.execute(
            "UPDATE organigramme_node SET parent_unit_id = ?, ordre = ? WHERE id = ? AND workflow_id = ?",
            (parent_uid, payload.ordre or 0, node_id, workflow_id)
        )
        conn.commit()
        cursor.execute(_NODE_SELECT + " AND n.id = ?", (workflow_id, node_id))
        return _node_row(cursor.fetchone())
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour du nœud: {str(e)}")
    finally:
        conn.close()


@router.delete("/{workflow_id}/nodes/{node_id}")
def delete_node(workflow_id: int, node_id: int, current: dict = Depends(_manage)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        _require_workflow(cursor, workflow_id)
        cursor.execute("SELECT unit_id FROM organigramme_node WHERE id = ? AND workflow_id = ?", (node_id, workflow_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Nœud introuvable dans cet organigramme.")
        unit_id = row["unit_id"] if isinstance(row, dict) else row[0]
        # Les enfants (dans ce workflow) remontent à la racine.
        cursor.execute(
            "UPDATE organigramme_node SET parent_unit_id = NULL WHERE workflow_id = ? AND parent_unit_id = ?",
            (workflow_id, unit_id)
        )
        cursor.execute("DELETE FROM organigramme_node WHERE id = ? AND workflow_id = ?", (node_id, workflow_id))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression du nœud: {str(e)}")
    finally:
        conn.close()
