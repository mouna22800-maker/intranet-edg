from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from api.database import get_db_connection, create_user_notification
from api.models import ArticleResponse, ArticleBase
from api.auth import get_current_user, require_write_department
from api.sanitize import sanitize_html, sanitize_plain
import datetime
import json

router = APIRouter(
    prefix="/articles",
    tags=["articles"]
)


def _parse_files(raw):
    """Décode la colonne news.files (JSON de type [{name, url}, ...]) de manière robuste."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, ValueError):
        return []


# Catégories d'annonce autorisées (l'auteur choisit au moment de publier). Toute valeur inconnue
# retombe sur "communique" pour éviter de stocker n'importe quoi.
VALID_CATEGORIES = {
    "communique", "deces", "mariage", "naissance",
    "retraite", "recrue", "projet", "evenement",
}


def _norm_category(value):
    return value if value in VALID_CATEGORIES else "communique"

@router.get("", response_model=List[ArticleResponse])
def get_public_articles(
    department_id: Optional[int] = Query(None, description="Filtrer par ID de l'unité locale"),
    is_global: Optional[bool] = Query(None, description="Filtrer par actualités globales"),
    q: Optional[str] = Query(None, description="Recherche textuelle par mot-clé (titre ou contenu)")
):
    """
    Sert les articles guinéens du portail intranet EDG depuis la table news.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = "SELECT id, unity_id, label, excerpt, description, images, files, type, category, created_at FROM news WHERE 1=1"
        params = []

        if department_id is not None:
            query += " AND unity_id = ?"
            params.append(department_id)

        if is_global is not None:
            # type = 1 pour Global, 2 pour Local
            query += " AND type = ?"
            params.append(1 if is_global else 2)

        if q:
            query += " AND (label LIKE ? OR description LIKE ?)"
            like_param = f"%{q}%"
            params.append(like_param)
            params.append(like_param)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        articles_list = []
        for r in rows:
            desc = r["description"] or ""
            stored_excerpt = r["excerpt"]

            if stored_excerpt:
                # Ligne moderne : excerpt et corps sont deja separes
                excerpt = stored_excerpt
                content = desc
            else:
                # Ligne historique (avant l'ajout de la colonne excerpt) : le corps
                # concatenait "excerpt\n\ncorps" dans description. On derive l'excerpt
                # et on retire ce prefixe du corps affiche pour eviter la duplication.
                if "\n\n" in desc:
                    excerpt, content = desc.split("\n\n", 1)
                else:
                    excerpt, content = desc, desc
                if len(excerpt) > 150:
                    excerpt = excerpt[:147] + "..."

            articles_list.append({
                "id": r["id"],
                "title": r["label"],
                "excerpt": excerpt,
                "content": content,
                "category": _norm_category(r["category"]),
                "tags": ["EDG", "Intranet"], # tags fictifs ou stockés dans les métadonnées
                "isGlobal": r["type"] == 1,
                "departmentId": r["unity_id"],
                "createdAt": r["created_at"],
                "image": r["images"] or "",
                "files": _parse_files(r["files"])
            })
        return articles_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès aux actualités: {str(e)}")
    finally:
        conn.close()


@router.post("", response_model=ArticleResponse)
def create_article(article: ArticleBase, current_user: dict = Depends(get_current_user)):
    require_write_department(article.departmentId, current_user)
    # Anti XSS stocké : le corps est du HTML riche affiché tel quel côté client => on l'assainit.
    safe_content = sanitize_html(article.content)
    # Le chapeau est affiché en TEXTE BRUT : on retire tout balisage HTML éventuel (ex. chapeau
    # auto-généré depuis le contenu enrichi) pour ne pas afficher de <strong> littéral.
    safe_excerpt = sanitize_plain(article.excerpt)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        created_at_iso = datetime.datetime.utcnow().isoformat() + "Z"

        # type_news : 1 pour Global, 2 pour Local
        news_type = 1 if article.isGlobal else 2
        safe_category = _norm_category(article.category)
        files_json = json.dumps([f.model_dump() for f in article.files])

        cursor.execute("""
            INSERT INTO news (unity_id, label, excerpt, description, images, files, type, category, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            article.departmentId,
            article.title,
            safe_excerpt,
            safe_content,
            article.image or "",
            files_json,
            news_type,
            safe_category,
            created_at_iso
        ))
        new_id = cursor.lastrowid

        if not article.isGlobal and article.departmentId is not None:
            cursor.execute("""
                SELECT id FROM users
                WHERE unity_id = ? AND role IN ('agent', 'chef_service', 'rh_direction')
            """, (article.departmentId,))
            for row in cursor.fetchall():
                create_user_notification(
                    cursor, row["id"], 'article_new',
                    f"Nouvelle actualité : {article.title}",
                    "Une actualité vient d'être publiée pour votre direction."
                )

        conn.commit()
        return {
            "id": new_id,
            "title": article.title,
            "excerpt": safe_excerpt,
            "content": safe_content,
            "category": safe_category,
            "tags": article.tags,
            "isGlobal": article.isGlobal,
            "departmentId": article.departmentId,
            "createdAt": created_at_iso,
            "image": article.image or "",
            "files": article.files
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de l'article: {str(e)}")
    finally:
        conn.close()


@router.put("/{id}", response_model=ArticleResponse)
def update_article(id: int, article: ArticleBase, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT created_at, unity_id FROM news WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Article non trouvé")
        require_write_department(row["unity_id"], current_user)
        require_write_department(article.departmentId, current_user)
        created_at_iso = row["created_at"]

        news_type = 1 if article.isGlobal else 2
        safe_category = _norm_category(article.category)
        files_json = json.dumps([f.model_dump() for f in article.files])
        safe_content = sanitize_html(article.content)  # anti XSS stocké
        safe_excerpt = sanitize_plain(article.excerpt)  # chapeau affiché en texte brut => sans balises

        cursor.execute("""
            UPDATE news
            SET unity_id = ?, label = ?, excerpt = ?, description = ?, images = ?, files = ?, type = ?, category = ?
            WHERE id = ?
        """, (
            article.departmentId,
            article.title,
            safe_excerpt,
            safe_content,
            article.image or "",
            files_json,
            news_type,
            safe_category,
            id
        ))
        conn.commit()
        return {
            "id": id,
            "title": article.title,
            "excerpt": safe_excerpt,
            "content": safe_content,
            "category": safe_category,
            "tags": article.tags,
            "isGlobal": article.isGlobal,
            "departmentId": article.departmentId,
            "createdAt": created_at_iso,
            "image": article.image or "",
            "files": article.files
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour de l'article: {str(e)}")
    finally:
        conn.close()


@router.delete("/{id}")
def delete_article(id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, unity_id FROM news WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Article non trouvé")
        require_write_department(row["unity_id"], current_user)

        cursor.execute("DELETE FROM news WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Article supprimé"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression de l'article: {str(e)}")
    finally:
        conn.close()
