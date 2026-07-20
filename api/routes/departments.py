from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import json
from api.database import get_db_connection
from api.models import DepartmentResponse

router = APIRouter(
    prefix="/departments",
    tags=["departments"]
)


def _get_dashboard(cursor, unity_id: int):
    cursor.execute("""
        SELECT title, subtitle, chart_type, kpis, series, chart_data
        FROM dashboard WHERE unity_id = ?
    """, (unity_id,))
    row = cursor.fetchone()
    if not row:
        return None
    try:
        kpis = json.loads(row["kpis"]) if row["kpis"] else []
    except (TypeError, ValueError):
        kpis = []
    try:
        series = json.loads(row["series"]) if row["series"] else []
    except (TypeError, ValueError):
        series = []
    try:
        chart_data = json.loads(row["chart_data"]) if row["chart_data"] else []
    except (TypeError, ValueError):
        chart_data = []
    return {
        "title": row["title"],
        "subtitle": row["subtitle"] or "",
        "chartType": row["chart_type"] or "area",
        "kpis": kpis,
        "series": series,
        "chartData": chart_data
    }

@router.get("", response_model=List[DepartmentResponse])
def get_public_departments():
    """Sert la liste complète des directions (Unity) d'EDG."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Récupérer d'abord toutes les unités
        cursor.execute("""
            SELECT id, label as name, code, description, icon, director_name, founded_year, staff_count, theme_color, parent_id
            FROM unity
        """)
        rows = cursor.fetchall()
        depts = []
        for r in rows:
            # Récupérer le message du directeur (content type = 1 : Présentation)
            cursor.execute("""
                SELECT description FROM content 
                WHERE unity_id = ? AND type = 1 
                LIMIT 1
            """, (r["id"],))
            pres_row = cursor.fetchone()
            director_message = pres_row["description"] if pres_row else ""

            # Récupérer les valeurs de la direction (content type = 3 : Nos valeurs, potentiellement plusieurs)
            cursor.execute("""
                SELECT label, description FROM content
                WHERE unity_id = ? AND type = 3
                ORDER BY ordre
            """, (r["id"],))
            value_rows = cursor.fetchall()
            values_list = [{"title": row["label"], "desc": row["description"]} for row in value_rows]
            value_key = values_list[0]["title"] if values_list else ""
            value_desc = values_list[0]["desc"] if values_list else ""

            # Récupérer les ids des applications liées (via unity_applications)
            cursor.execute("""
                SELECT application_id FROM unity_applications
                WHERE unity_id = ?
            """, (r["id"],))
            apps_rows = cursor.fetchall()
            bound_app_ids = [row["application_id"] for row in apps_rows]

            # Piliers de mission (content type = 4 : Nos missions)
            cursor.execute("""
                SELECT label, description FROM content
                WHERE unity_id = ? AND type = 4
                ORDER BY ordre
            """, (r["id"],))
            mission_pillars = [{"title": row["label"], "desc": row["description"]} for row in cursor.fetchall()]

            # Engagements de service (content type = 2 : Nos engagements)
            # icone est reutilise pour stocker le "metric" (ex: 99.9%, < 4h)
            cursor.execute("""
                SELECT label, description, summary, icone FROM content
                WHERE unity_id = ? AND type = 2
                ORDER BY ordre
            """, (r["id"],))
            commitments = [
                {"title": row["label"], "metric": row["icone"] or "", "description": row["description"], "objective": row["summary"] or ""}
                for row in cursor.fetchall()
            ]

            # Domaines d'intervention (content type = 6)
            cursor.execute("""
                SELECT label, description, icone FROM content
                WHERE unity_id = ? AND type = 6
                ORDER BY ordre
            """, (r["id"],))
            domains = [{"title": row["label"], "desc": row["description"], "icon": row["icone"] or "Target"} for row in cursor.fetchall()]

            # Historique de la direction (content type = 7)
            cursor.execute("""
                SELECT description FROM content
                WHERE unity_id = ? AND type = 7
                LIMIT 1
            """, (r["id"],))
            history_row = cursor.fetchone()
            history_text = history_row["description"] if history_row else ""

            dashboard = _get_dashboard(cursor, r["id"])

            depts.append({
                "id": r["id"],
                "parentId": r["parent_id"],
                "code": r["code"],
                "name": r["name"],
                "description": r["description"] or "",
                "icon": r["icon"] or "Layers",
                "director_name": r["director_name"],
                "director_message": director_message or "",
                "founded_year": r["founded_year"] or 1987,
                "staff_count": r["staff_count"] or 10,
                "value_key": value_key or "",
                "value_desc": value_desc or "",
                "theme_color": r["theme_color"] or "emerald",
                "application_ids": bound_app_ids,
                "missionPillars": mission_pillars,
                "commitments": commitments,
                "domains": domains,
                "values": values_list,
                "historyText": history_text,
                "dashboard": dashboard
            })
        return depts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès aux directions: {str(e)}")
    finally:
        conn.close()

@router.get("/{id}/projects")
def get_department_projects(id: int):
    """Sert la liste des projets associés à une direction."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.label, p.description, p.image, p.date_debut, p.date_fin, p.niveau, tp.label as type_label
            FROM projet p
            JOIN type_projet tp ON p.type_id = tp.id
            WHERE p.unity_id = ?
        """, (id,))
        rows = cursor.fetchall()
        projects = []
        for r in rows:
            projects.append({
                "id": r["id"],
                "label": r["label"],
                "description": r["description"],
                "image": r["image"],
                "date_debut": r["date_debut"],
                "date_fin": r["date_fin"],
                "niveau": r["niveau"],
                "type": r["type_label"]
            })
        return {"status": "success", "data": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des projets: {str(e)}")
    finally:
        conn.close()

@router.get("/{id}/contacts")
def get_department_contacts(id: int):
    """Sert la liste des contacts et destinataires de l'unité."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, numero, raison
            FROM recipient
            WHERE id_unity = ?
        """, (id,))
        recipients_rows = cursor.fetchall()
        
        results = []
        for rec in recipients_rows:
            cursor.execute("""
                SELECT email, numero
                FROM contact
                WHERE id_recipient = ?
            """, (rec["id"],))
            contacts_rows = cursor.fetchall()
            
            contacts_list = []
            for c in contacts_rows:
                contacts_list.append({
                    "email": c["email"],
                    "numero": c["numero"]
                })
                
            results.append({
                "recipient_id": rec["id"],
                "email": rec["email"],
                "numero": rec["numero"],
                "raison": rec["raison"],
                "associated_contacts": contacts_list
            })
        return {"status": "success", "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des contacts: {str(e)}")
    finally:
        conn.close()
