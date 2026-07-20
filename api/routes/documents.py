from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import datetime
from api.database import get_db_connection
from api.models import DocumentResponse, DocumentBase
from api.auth import get_current_user, require_write_department

router = APIRouter(
    prefix="/documents",
    tags=["documents"]
)


def _row_to_document(r):
    created_at = r["created_at"]
    if isinstance(created_at, (datetime.datetime, datetime.date)):
        created_at = created_at.isoformat()
    return {
        "id": r["id"],
        "title": r["title"],
        "category": r["category"],
        "departmentId": r["unity_id"],
        "departmentLabel": r["unity_label"] or "",
        "author": r["author"] or "",
        "fileUrl": r["file_url"],
        "fileSize": r["file_size"] or 0,
        "createdAt": created_at
    }


@router.get("", response_model=List[DocumentResponse])
def get_documents(
    category: Optional[str] = Query(None, description="Filtrer par catégorie"),
    department_id: Optional[int] = Query(None, description="Filtrer par direction")
):
    """Sert la bibliothèque de documents (GED) : notes de service, directives, modèles, formulaires."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = """
            SELECT d.id, d.title, d.category, d.unity_id, d.author, d.file_url, d.file_size, d.created_at,
                   u.label as unity_label
            FROM documents d
            LEFT JOIN unity u ON d.unity_id = u.id
            WHERE 1=1
        """
        params = []
        if category is not None:
            query += " AND d.category = ?"
            params.append(category)
        if department_id is not None:
            query += " AND d.unity_id = ?"
            params.append(department_id)
        query += " ORDER BY d.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [_row_to_document(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès à la bibliothèque de documents: {str(e)}")
    finally:
        conn.close()


@router.post("", response_model=DocumentResponse)
def create_document(doc: DocumentBase, current_user: dict = Depends(get_current_user)):
    require_write_department(doc.departmentId, current_user)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        created_at_iso = datetime.datetime.utcnow().isoformat() + "Z"
        cursor.execute("""
            INSERT INTO documents (title, category, unity_id, author, file_url, file_size, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (doc.title, doc.category, doc.departmentId, doc.author or "", doc.fileUrl, doc.fileSize or 0, created_at_iso))
        conn.commit()
        new_id = cursor.lastrowid
        return {
            "id": new_id,
            "title": doc.title,
            "category": doc.category,
            "departmentId": doc.departmentId,
            "departmentLabel": "",
            "author": doc.author or "",
            "fileUrl": doc.fileUrl,
            "fileSize": doc.fileSize or 0,
            "createdAt": created_at_iso
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'ajout du document: {str(e)}")
    finally:
        conn.close()


@router.delete("/{id}")
def delete_document(id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, unity_id FROM documents WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document non trouvé")
        require_write_department(row["unity_id"], current_user)
        cursor.execute("DELETE FROM documents WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Document supprimé"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression du document: {str(e)}")
    finally:
        conn.close()
