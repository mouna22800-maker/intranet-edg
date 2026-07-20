from fastapi import APIRouter, HTTPException, Depends
from typing import List
from api.database import get_db_connection
from api.models import UserNotificationResponse
from api.auth import get_current_user

router = APIRouter(
    prefix="/my-notifications",
    tags=["user-notifications"]
)

# Association type -> icône Lucide affichée côté frontend (extensible sans migration de schéma)
TYPE_ICONS = {
    'ticket_new': 'AlertCircle',
    'ticket_status': 'CheckCheck',
    'article_new': 'Bookmark',
    'account_new': 'Compass',
}


def _row_to_notification(r):
    return {
        "id": r["id"],
        "type": r["type"],
        "title": r["title"],
        "message": r["message"],
        "icon": TYPE_ICONS.get(r["type"], "Bell"),
        "isRead": bool(r["is_read"]),
        "createdAt": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else r["created_at"]
    }


@router.get("", response_model=List[UserNotificationResponse])
def get_my_notifications(current_user: dict = Depends(get_current_user)):
    """Sert les notifications personnelles temps réel de l'utilisateur connecté (agent ou admin)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, type, title, message, is_read, created_at
            FROM user_notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        """, (int(current_user.get("sub")),))
        return [_row_to_notification(r) for r in cursor.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès aux notifications: {str(e)}")
    finally:
        conn.close()


@router.patch("/{id}/read")
def mark_my_notification_read(id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM user_notifications WHERE id = ? AND user_id = ?", (id, int(current_user.get("sub"))))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Notification non trouvée")
        cursor.execute("UPDATE user_notifications SET is_read = 1 WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")
    finally:
        conn.close()


@router.post("/mark-all-read")
def mark_all_my_notifications_read(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE user_notifications SET is_read = 1 WHERE user_id = ?", (int(current_user.get("sub")),))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")
    finally:
        conn.close()
