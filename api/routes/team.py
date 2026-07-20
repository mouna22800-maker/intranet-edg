from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import json
from api.database import get_db_connection
from api.models import TeamMemberResponse, TeamMemberBase
from api.auth import require_role, require_write_department

router = APIRouter(
    prefix="/team-members",
    tags=["team-members"]
)


def _row_to_member(r):
    try:
        responsibilities = json.loads(r["responsibilities"]) if r["responsibilities"] else []
    except (TypeError, ValueError):
        responsibilities = []
    return {
        "id": str(r["id"]),
        "departmentId": r["unity_id"],
        "name": r["name"],
        "role": r["role"],
        "email": r["email"],
        "phone": r["phone"] or "",
        "bio": r["bio"] or "",
        "responsibilities": responsibilities,
        "hierarchy_order": r["hierarchy_order"] if r["hierarchy_order"] is not None else 10
    }


@router.get("", response_model=List[TeamMemberResponse])
def get_team_members(department_id: Optional[int] = Query(None, description="Filtrer par ID de direction")):
    """Sert les fiches individuelles de l'organigramme (équipe) de l'EDG."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = "SELECT id, unity_id, name, role, email, phone, bio, responsibilities, hierarchy_order FROM team_members WHERE 1=1"
        params = []
        if department_id is not None:
            query += " AND unity_id = ?"
            params.append(department_id)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_member(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès à l'organigramme: {str(e)}")
    finally:
        conn.close()


@router.post("", response_model=TeamMemberResponse)
def create_team_member(member: TeamMemberBase, current_user: dict = Depends(require_role('rh_direction', 'administrateur'))):
    require_write_department(member.departmentId, current_user)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO team_members (unity_id, name, role, email, phone, bio, responsibilities, hierarchy_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            member.departmentId, member.name, member.role, member.email,
            member.phone or "", member.bio or "", json.dumps(member.responsibilities or []),
            member.hierarchy_order or 10
        ))
        conn.commit()
        new_id = cursor.lastrowid
        return {
            "id": str(new_id),
            "departmentId": member.departmentId,
            "name": member.name,
            "role": member.role,
            "email": member.email,
            "phone": member.phone or "",
            "bio": member.bio or "",
            "responsibilities": member.responsibilities or [],
            "hierarchy_order": member.hierarchy_order or 10
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de la fiche: {str(e)}")
    finally:
        conn.close()


@router.put("/{id}", response_model=TeamMemberResponse)
def update_team_member(id: int, member: TeamMemberBase, current_user: dict = Depends(require_role('rh_direction', 'administrateur'))):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, unity_id FROM team_members WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Fiche d'équipe introuvable")
        require_write_department(row["unity_id"], current_user)
        require_write_department(member.departmentId, current_user)
        cursor.execute("""
            UPDATE team_members
            SET unity_id = ?, name = ?, role = ?, email = ?, phone = ?, bio = ?, responsibilities = ?, hierarchy_order = ?
            WHERE id = ?
        """, (
            member.departmentId, member.name, member.role, member.email,
            member.phone or "", member.bio or "", json.dumps(member.responsibilities or []),
            member.hierarchy_order or 10, id
        ))
        conn.commit()
        return {
            "id": str(id),
            "departmentId": member.departmentId,
            "name": member.name,
            "role": member.role,
            "email": member.email,
            "phone": member.phone or "",
            "bio": member.bio or "",
            "responsibilities": member.responsibilities or [],
            "hierarchy_order": member.hierarchy_order or 10
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour de la fiche: {str(e)}")
    finally:
        conn.close()


@router.delete("/{id}")
def delete_team_member(id: int, current_user: dict = Depends(require_role('rh_direction', 'administrateur'))):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, unity_id FROM team_members WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Fiche d'équipe introuvable")
        require_write_department(row["unity_id"], current_user)
        cursor.execute("DELETE FROM team_members WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Fiche d'équipe supprimée"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression de la fiche: {str(e)}")
    finally:
        conn.close()
