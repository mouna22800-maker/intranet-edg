import os
import secrets
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from api.database import UPLOAD_DIR
from api.auth import get_current_user

router = APIRouter(
    prefix="/upload",
    tags=["upload"]
)

# SVG volontairement EXCLU : un fichier .svg peut contenir du JavaScript (risque XSS une fois servi).
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 Mo

ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"}
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10 Mo


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint dédié au téléversement d'images pour les actualités et les projets.
    Stocke le fichier dans /uploads et retourne son chemin d'accès public (/uploads/<nom>).
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Fichier invalide.")

    _, file_ext = os.path.splitext(file.filename.lower())
    if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Format d'image non supporté. Formats acceptés : JPG, PNG, WEBP, GIF."
        )

    filename = f"img_{secrets.token_hex(8)}{file_ext}"
    dest_path = os.path.join(UPLOAD_DIR, filename)
    size = 0

    try:
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 64):
                size += len(chunk)
                if size > MAX_IMAGE_SIZE:
                    buffer.close()
                    if os.path.exists(dest_path):
                        os.remove(dest_path)
                    raise HTTPException(
                        status_code=400,
                        detail="L'image dépasse la limite de taille autorisée (5 Mo)."
                    )
                buffer.write(chunk)
    except Exception as e:
        if not isinstance(e, HTTPException):
            if os.path.exists(dest_path):
                os.remove(dest_path)
            raise HTTPException(status_code=500, detail=f"Erreur d'écriture du fichier : {str(e)}")
        raise e

    return {
        "status": "success",
        "url": f"/uploads/{filename}"
    }


@router.post("/document")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint dédié au téléversement de documents (PDF, Word, Excel, PowerPoint)
    joints aux actualités. Stocke le fichier dans /uploads et retourne son chemin d'accès public.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Fichier invalide.")

    _, file_ext = os.path.splitext(file.filename.lower())
    if file_ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Format de document non supporté. Formats acceptés : PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX."
        )

    filename = f"doc_{secrets.token_hex(8)}{file_ext}"
    dest_path = os.path.join(UPLOAD_DIR, filename)
    size = 0

    try:
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 64):
                size += len(chunk)
                if size > MAX_DOCUMENT_SIZE:
                    buffer.close()
                    if os.path.exists(dest_path):
                        os.remove(dest_path)
                    raise HTTPException(
                        status_code=400,
                        detail="Le document dépasse la limite de taille autorisée (10 Mo)."
                    )
                buffer.write(chunk)
    except Exception as e:
        if not isinstance(e, HTTPException):
            if os.path.exists(dest_path):
                os.remove(dest_path)
            raise HTTPException(status_code=500, detail=f"Erreur d'écriture du fichier : {str(e)}")
        raise e

    return {
        "status": "success",
        "url": f"/uploads/{filename}"
    }
