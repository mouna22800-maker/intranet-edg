from fastapi import APIRouter, HTTPException, Query, Depends, Cookie
from typing import List, Optional
import datetime
import secrets
import jwt
from api.database import get_db_connection, notify_users_for_department, create_user_notification
from api.models import TicketResponse, TicketBase, TicketStatusUpdate, PaginatedTickets
from api.auth import require_role, require_write_department, get_current_user, SECRET_KEY, ALGORITHM

router = APIRouter(
    prefix="/tickets",
    tags=["tickets"]
)


def _row_to_ticket(r):
    return {
        "id": r["id"],
        "type": r["type"],
        "senderName": r["sender_name"],
        "senderEmail": r["sender_email"],
        "subject": r["subject"],
        "message": r["message"],
        "departmentId": r["unity_id"],
        "createdAt": r["created_at"],
        "status": r["status"] or "Nouveau",
        "priority": r["priority"]
    }


@router.get("", response_model=PaginatedTickets)
def get_tickets(
    department_id: Optional[int] = Query(None, description="Filtrer par direction concernée"),
    type: Optional[str] = Query(None, description="'contact' ou 'incident'"),
    status: Optional[str] = Query(None, description="Statut du ticket"),
    search: Optional[str] = Query(None, description="Recherche sur l'objet, l'émetteur, l'email ou l'ID"),
    page: int = Query(1, ge=1, description="Numéro de page (1-indexé)"),
    page_size: int = Query(20, ge=1, le=100, description="Nombre de tickets par page"),
    current_user: dict = Depends(require_role('chef_service', 'rh_direction', 'administrateur'))
):
    """Sert le registre des signalements d'incident et demandes de contact (réservé à l'administration : contient noms, emails et messages de tous les émetteurs)."""
    role = current_user.get("role")
    user_unity_id = current_user.get("unity_id")
    if role == "chef_service" or (role == "rh_direction" and user_unity_id is not None):
        # Chef de service / Directeur : cloisonné à sa propre direction, quel que soit le filtre demandé
        department_id = user_unity_id
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        where = "WHERE 1=1"
        params = []
        if department_id is not None:
            where += " AND unity_id = ?"
            params.append(department_id)
        if type is not None:
            where += " AND type = ?"
            params.append(type)
        if status is not None:
            where += " AND status = ?"
            params.append(status)
        if search and search.strip():
            where += " AND (subject LIKE ? OR sender_name LIKE ? OR sender_email LIKE ? OR id LIKE ?)"
            like = f"%{search.strip()}%"
            params += [like, like, like, like]

        cursor.execute(f"SELECT COUNT(*) as cnt FROM tickets {where}", params)
        res = cursor.fetchone()
        total = res["cnt"] if isinstance(res, dict) else res[0]

        offset = (page - 1) * page_size
        cursor.execute(
            f"SELECT id, type, sender_name, sender_email, subject, message, unity_id, created_at, status, priority "
            f"FROM tickets {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [page_size, offset]
        )
        items = [_row_to_ticket(r) for r in cursor.fetchall()]
        return {"items": items, "total": total, "page": page, "pageSize": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès aux tickets: {str(e)}")
    finally:
        conn.close()


@router.get("/track", response_model=List[TicketResponse])
def track_tickets(
    email: Optional[str] = Query(None, description="Email utilisé lors de la soumission"),
    ticket_id: Optional[str] = Query(None, description="Identifiant exact du ticket (ex: EDG-CON-3C06E1)")
):
    """
    Suivi public en libre-service : permet à l'auteur d'une demande de consulter le statut
    de son (ses) propre(s) ticket(s), sans exposer le registre complet à tout visiteur.
    Nécessite de connaître l'email de soumission ou l'identifiant exact du ticket reçu à la création.
    """
    email_clean = (email or "").strip().lower()
    ticket_id_clean = (ticket_id or "").strip()

    if not email_clean and not ticket_id_clean:
        raise HTTPException(status_code=400, detail="Veuillez renseigner votre email ou l'identifiant de votre ticket.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if ticket_id_clean:
            cursor.execute(
                "SELECT id, type, sender_name, sender_email, subject, message, unity_id, created_at, status, priority "
                "FROM tickets WHERE id = ?",
                (ticket_id_clean,)
            )
        else:
            cursor.execute(
                "SELECT id, type, sender_name, sender_email, subject, message, unity_id, created_at, status, priority "
                "FROM tickets WHERE LOWER(sender_email) = ? ORDER BY created_at DESC",
                (email_clean,)
            )
        rows = cursor.fetchall()
        return [_row_to_ticket(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la recherche du ticket: {str(e)}")
    finally:
        conn.close()


@router.post("", response_model=TicketResponse)
def create_ticket(ticket: TicketBase, edg_session: str = Cookie(None)):
    # Rattache le ticket au COMPTE CONNECTÉ (via le cookie de session), indépendamment de l'email saisi
    # dans le formulaire : ainsi l'auteur est notifié même s'il indique une autre adresse. Reste optionnel
    # (un futur dépôt anonyme fonctionnerait avec submitter_user_id = NULL).
    submitter_user_id = None
    if edg_session:
        try:
            claims = jwt.decode(edg_session, SECRET_KEY, algorithms=[ALGORITHM])
            submitter_user_id = int(claims.get("sub")) if claims.get("sub") else None
        except Exception:
            submitter_user_id = None

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        prefix = "INC" if ticket.type == "incident" else "CON"
        new_id = f"EDG-{prefix}-{secrets.token_hex(3).upper()}"
        created_at_iso = datetime.datetime.utcnow().isoformat() + "Z"

        cursor.execute("""
            INSERT INTO tickets (id, type, sender_name, sender_email, subject, message, unity_id, created_at, status, priority, submitter_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Nouveau', ?, ?)
        """, (
            new_id, ticket.type, ticket.senderName, ticket.senderEmail,
            ticket.subject, ticket.message, ticket.departmentId, created_at_iso,
            ticket.priority if ticket.type == "incident" else None,
            submitter_user_id
        ))
        label = "Signalement d'incident" if ticket.type == "incident" else "Demande de contact"
        notify_users_for_department(
            cursor, ticket.departmentId, 'ticket_new',
            f"Nouveau ticket : {ticket.subject}",
            f"{label} soumis par {ticket.senderName} pour votre direction."
        )
        conn.commit()
        return {
            "id": new_id,
            "type": ticket.type,
            "senderName": ticket.senderName,
            "senderEmail": ticket.senderEmail,
            "subject": ticket.subject,
            "message": ticket.message,
            "departmentId": ticket.departmentId,
            "createdAt": created_at_iso,
            "status": "Nouveau",
            "priority": ticket.priority if ticket.type == "incident" else None
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création du ticket: {str(e)}")
    finally:
        conn.close()


@router.patch("/{id}/status", response_model=TicketResponse)
def update_ticket_status(id: str, update: TicketStatusUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, unity_id, sender_email, subject, submitter_user_id FROM tickets WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Ticket non trouvé")
        require_write_department(row["unity_id"], current_user)
        cursor.execute("UPDATE tickets SET status = ? WHERE id = ?", (update.status, id))

        # Notifie l'AUTEUR de la demande : en priorité le compte rattaché à la création
        # (peu importe l'email saisi), avec repli sur une correspondance par email pour les anciens tickets.
        notify_user_id = row["submitter_user_id"]
        if not notify_user_id:
            cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (row["sender_email"].strip().lower(),))
            submitter = cursor.fetchone()
            notify_user_id = submitter["id"] if submitter else None
        if notify_user_id:
            create_user_notification(
                cursor, notify_user_id, 'ticket_status',
                f"Ticket {id} mis à jour",
                f"Votre demande « {row['subject']} » est maintenant « {update.status} »."
            )

        conn.commit()
        cursor.execute("SELECT id, type, sender_name, sender_email, subject, message, unity_id, created_at, status, priority FROM tickets WHERE id = ?", (id,))
        return _row_to_ticket(cursor.fetchone())
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour du ticket: {str(e)}")
    finally:
        conn.close()


@router.delete("/{id}")
def delete_ticket(id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, unity_id FROM tickets WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Ticket non trouvé")
        require_write_department(row["unity_id"], current_user)
        cursor.execute("DELETE FROM tickets WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Ticket supprimé"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression du ticket: {str(e)}")
    finally:
        conn.close()
