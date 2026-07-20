from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from api.database import get_db_connection
from api.models import EventBase, EventResponse
from api.auth import require_role

router = APIRouter(
    prefix="/events",
    tags=["events"]
)


def _row_to_event(r):
    event_date = r["event_date"]
    if hasattr(event_date, "isoformat"):
        event_date = event_date.isoformat()
    return {
        "id": str(r["id"]),
        "title": r["title"],
        "type": r["type"],
        "departmentId": r["unity_id"],
        "departmentLabel": r["unity_label"] or "",
        "date": event_date,
        "time": r["event_time"] or "",
        "location": r["location"] or "",
        "host": r["host"] or ""
    }


@router.get("", response_model=List[EventResponse])
def get_events():
    """Sert l'agenda institutionnel (réunions et événements des directions), consultable librement."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT e.id, e.title, e.type, e.unity_id, e.event_date, e.event_time, e.location, e.host,
                   u.label as unity_label
            FROM events e
            LEFT JOIN unity u ON e.unity_id = u.id
            ORDER BY e.event_date ASC
        """)
        return [_row_to_event(r) for r in cursor.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès à l'agenda: {str(e)}")
    finally:
        conn.close()


@router.post("", response_model=EventResponse)
def create_event(event: EventBase, current_user: dict = Depends(require_role('chef_service', 'rh_direction', 'administrateur'))):
    """
    Planifie un événement institutionnel. Réservé aux Chefs de service, RH/Direction et Administrateurs
    (mêmes privilèges d'écriture que les actualités/projets de direction).
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO events (title, type, unity_id, event_date, event_time, location, host)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            event.title.strip(), event.type, event.departmentId, event.date,
            (event.time or "").strip(), (event.location or "").strip(), (event.host or "").strip()
        ))
        conn.commit()
        new_id = cursor.lastrowid

        unity_label = ""
        if event.departmentId is not None:
            cursor.execute("SELECT label FROM unity WHERE id = ?", (event.departmentId,))
            row = cursor.fetchone()
            unity_label = row["label"] if row else ""

        return {
            "id": str(new_id),
            "title": event.title.strip(),
            "type": event.type,
            "departmentId": event.departmentId,
            "departmentLabel": unity_label,
            "date": event.date,
            "time": (event.time or "").strip(),
            "location": (event.location or "").strip(),
            "host": (event.host or "").strip()
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de l'événement: {str(e)}")
    finally:
        conn.close()
