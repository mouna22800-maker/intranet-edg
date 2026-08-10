import os
import json
import secrets
import sqlite3
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from typing import Optional, List
from api.database import get_db_connection, UPLOAD_DIR
from api.models import AdminDirectionSaveResponse
from api.auth import require_role, require_write_department, get_current_user
from api.sanitize import sanitize_html, sanitize_plain

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

@router.get("/directions")
def list_directions():
    """Récupère l'intégralité des directions administratives (Unity) avec leurs contenus."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.code, u.label as name, u.description, u.icon, u.director_name, u.founded_year, u.staff_count, u.theme_color,
                   c1.description as director_message
            FROM unity u
            LEFT JOIN content c1 ON u.id = c1.unity_id AND c1.type = 1
        """)
        rows = cursor.fetchall()
        directions = []
        for row in rows:
            cursor.execute("SELECT label, description FROM content WHERE unity_id = ? AND type = 4 ORDER BY ordre", (row["id"],))
            mission_pillars = [{"title": r["label"], "desc": r["description"]} for r in cursor.fetchall()]

            cursor.execute("SELECT label, description, summary, icone FROM content WHERE unity_id = ? AND type = 2 ORDER BY ordre", (row["id"],))
            commitments = [
                {"title": r["label"], "metric": r["icone"] or "", "description": r["description"], "objective": r["summary"] or ""}
                for r in cursor.fetchall()
            ]

            cursor.execute("SELECT label, description, icone FROM content WHERE unity_id = ? AND type = 6 ORDER BY ordre", (row["id"],))
            domains = [{"title": r["label"], "desc": r["description"], "icon": r["icone"] or "Target"} for r in cursor.fetchall()]

            cursor.execute("SELECT label, description FROM content WHERE unity_id = ? AND type = 3 ORDER BY ordre", (row["id"],))
            values_list = [{"title": r["label"], "desc": r["description"]} for r in cursor.fetchall()]

            cursor.execute("SELECT description FROM content WHERE unity_id = ? AND type = 7 LIMIT 1", (row["id"],))
            history_row = cursor.fetchone()

            cursor.execute("SELECT title, subtitle, chart_type, kpis, series, chart_data FROM dashboard WHERE unity_id = ?", (row["id"],))
            dash_row = cursor.fetchone()
            dashboard = None
            if dash_row:
                try:
                    kpis = json.loads(dash_row["kpis"]) if dash_row["kpis"] else []
                except (TypeError, ValueError):
                    kpis = []
                try:
                    series = json.loads(dash_row["series"]) if dash_row["series"] else []
                except (TypeError, ValueError):
                    series = []
                try:
                    chart_data = json.loads(dash_row["chart_data"]) if dash_row["chart_data"] else []
                except (TypeError, ValueError):
                    chart_data = []
                dashboard = {
                    "title": dash_row["title"],
                    "subtitle": dash_row["subtitle"] or "",
                    "chartType": dash_row["chart_type"] or "area",
                    "kpis": kpis,
                    "series": series,
                    "chartData": chart_data
                }

            directions.append({
                "id": row["id"],
                "code": row["code"],
                "name": row["name"],
                "description": row["description"] or "",
                "icon": row["icon"] or "Layers",
                "director_name": row["director_name"],
                "director_message": row["director_message"] or "",
                "value_key": values_list[0]["title"] if values_list else "",
                "value_desc": values_list[0]["desc"] if values_list else "",
                "founded_year": row["founded_year"] or 1987,
                "staff_count": row["staff_count"] or 10,
                "theme_color": row["theme_color"] or "emerald",
                "missionPillars": mission_pillars,
                "commitments": commitments,
                "domains": domains,
                "values": values_list,
                "historyText": history_row["description"] if history_row else "",
                "dashboard": dashboard
            })
        return {"status": "success", "data": directions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'accès d'administration: {str(e)}")
    finally:
        conn.close()

@router.post("/direction/save")
async def save_direction(
    id: Optional[int] = Form(None),
    code: str = Form(...),
    name: str = Form(...),
    description: str = Form(""),
    director_name: str = Form(...),
    founded_year: int = Form(1987),
    staff_count: int = Form(10),
    parent_id: Optional[int] = Form(None),
    icon: str = Form("Layers"),
    director_message: str = Form(""),
    value_key: str = Form(""),
    value_desc: str = Form(""),
    existing_logo: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    applications: Optional[str] = Form(None),
    mission_pillars: Optional[str] = Form(None),
    commitments: Optional[str] = Form(None),
    domains: Optional[str] = Form(None),
    values: Optional[str] = Form(None),
    history_text: Optional[str] = Form(None),
    dashboard: Optional[str] = Form(None),
    admin_auth: dict = Depends(require_role('administrateur'))
):
    """
    Crée ou met à jour de manière transactionnelle une direction d'EDG,
    gère avec robustesse le téléversement de logo et associe les applications métiers utiles.
    """
    clean_code = code.strip().lower()
    clean_name = name.strip()
    clean_director = director_name.strip()

    # parent_id : NULL si vide/0, et jamais soi-même (pas d'auto-parent).
    if parent_id in (0, None) or (id is not None and parent_id == id):
        parent_id = None

    # Anti XSS stocké : ces champs riches sont affichés tels quels côté client (dangerouslySetInnerHTML).
    director_message = sanitize_html(director_message)
    if history_text is not None:
        history_text = sanitize_html(history_text)
    # La "Mission en chef" (description) est affichée en TEXTE BRUT partout (cartes, recherche, à-propos)
    # => on retire tout balisage pour ne jamais afficher de <strong> en clair.
    description = sanitize_plain(description)

    if not clean_code or not clean_name or not clean_director:
        raise HTTPException(
            status_code=400, 
            detail="Erreur de saisie : Les champs Code, Nom complet et Directeur sont obligatoires."
        )

    logo_path = existing_logo or ""

    # Traitement sécurisé du téléversement de l'image (logo) — SVG exclu (risque XSS)
    if logo and logo.filename:
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        _, file_ext = os.path.splitext(logo.filename.lower())
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail="Format d'image non supporté. Seuls JPG, PNG et WEBP sont acceptés."
            )

        MAX_SIZE = 2 * 1024 * 1024
        size = 0
        temp_filename = f"dept_{clean_code}_{secrets.token_hex(8)}{file_ext}"
        temp_dest = os.path.join(UPLOAD_DIR, temp_filename)
        
        try:
            with open(temp_dest, "wb") as buffer:
                while chunk := await logo.read(1024 * 64):
                    size += len(chunk)
                    if size > MAX_SIZE:
                        buffer.close()
                        if os.path.exists(temp_dest):
                            os.remove(temp_dest)
                        raise HTTPException(
                            status_code=400,
                            detail="Le fichier téléversé dépasse la limite de taille autorisée (2 Mo)."
                        )
                    buffer.write(chunk)
            
            logo_path = f"uploads/{temp_filename}"
        except Exception as e:
            if not isinstance(e, HTTPException):
                if os.path.exists(temp_dest):
                    os.remove(temp_dest)
                raise HTTPException(status_code=500, detail=f"Erreur d'écriture de fichier: {str(e)}")
            raise e

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        if id:
            # --- MODE MODIFICATION ---
            cursor.execute("""
                UPDATE unity
                SET code = ?, label = ?, description = ?, icon = ?, director_name = ?, founded_year = ?, staff_count = ?, parent_id = ?
                WHERE id = ?
            """, (clean_code, clean_name, description.strip(), icon.strip(), clean_director, founded_year, staff_count, parent_id, id))
            
            # Content de type 1 : Présentation (director_message)
            cursor.execute("SELECT id FROM content WHERE unity_id = ? AND type = 1", (id,))
            if cursor.fetchone():
                cursor.execute("""
                    UPDATE content 
                    SET description = ?
                    WHERE unity_id = ? AND type = 1
                """, (director_message.strip(), id))
            else:
                cursor.execute("""
                    INSERT INTO content (unity_id, description, summary, label, type, ordre)
                    VALUES (?, ?, ?, 'Mot du Directeur', 1, 1)
                """, (id, director_message.strip(), clean_director))

            department_id = id
        else:
            # --- MODE CRÉATION ---
            cursor.execute("""
                INSERT INTO unity (code, label, description, icon, director_name, founded_year, staff_count, parent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (clean_code, clean_name, description.strip(), icon.strip(), clean_director, founded_year, staff_count, parent_id))
            department_id = cursor.lastrowid
            
            # Création Presentation
            cursor.execute("""
                INSERT INTO content (unity_id, description, summary, label, type, ordre)
                VALUES (?, ?, ?, 'Mot du Directeur', 1, 1)
            """, (department_id, director_message.strip(), clean_director))

        # Nettoyer les liaisons d'applications précédentes
        cursor.execute("DELETE FROM unity_applications WHERE unity_id = ?", (department_id,))
        
        if applications:
            app_ids = []
            try:
                app_ids = [int(x.strip()) for x in applications.replace("[", "").replace("]", "").split(",") if x.strip()]
            except ValueError:
                pass
            
            for app_id in app_ids:
                cursor.execute("""
                    INSERT INTO unity_applications (unity_id, application_id)
                    VALUES (?, ?)
                """, (department_id, app_id))

        # Piliers de mission (content type = 4) : remplacement complet
        if mission_pillars is not None:
            cursor.execute("DELETE FROM content WHERE unity_id = ? AND type = 4", (department_id,))
            try:
                pillars_list = json.loads(mission_pillars)
            except (TypeError, ValueError):
                pillars_list = []
            for idx, p in enumerate(pillars_list):
                title = str(p.get("title", "")).strip()
                desc = str(p.get("desc", "")).strip()
                if not title and not desc:
                    continue
                cursor.execute("""
                    INSERT INTO content (unity_id, label, description, type, ordre)
                    VALUES (?, ?, ?, 4, ?)
                """, (department_id, title, desc, idx + 1))

        # Engagements de service (content type = 2) : icone reutilise pour stocker le metric
        if commitments is not None:
            cursor.execute("DELETE FROM content WHERE unity_id = ? AND type = 2", (department_id,))
            try:
                commitments_list = json.loads(commitments)
            except (TypeError, ValueError):
                commitments_list = []
            for idx, c in enumerate(commitments_list):
                title = str(c.get("title", "")).strip()
                desc = str(c.get("description", "")).strip()
                metric = str(c.get("metric", "")).strip()
                objective = str(c.get("objective", "")).strip()
                if not title and not desc:
                    continue
                cursor.execute("""
                    INSERT INTO content (unity_id, label, description, summary, icone, type, ordre)
                    VALUES (?, ?, ?, ?, ?, 2, ?)
                """, (department_id, title, desc, objective, metric, idx + 1))

        # Domaines d'intervention (content type = 6)
        if domains is not None:
            cursor.execute("DELETE FROM content WHERE unity_id = ? AND type = 6", (department_id,))
            try:
                domains_list = json.loads(domains)
            except (TypeError, ValueError):
                domains_list = []
            for idx, d in enumerate(domains_list):
                title = str(d.get("title", "")).strip()
                desc = str(d.get("desc", "")).strip()
                icon_name = str(d.get("icon", "Target")).strip()
                if not title and not desc:
                    continue
                cursor.execute("""
                    INSERT INTO content (unity_id, label, description, icone, type, ordre)
                    VALUES (?, ?, ?, ?, 6, ?)
                """, (department_id, title, desc, icon_name, idx + 1))

        # Valeurs fondamentales (content type = 3) : remplacement complet
        if values is not None:
            cursor.execute("DELETE FROM content WHERE unity_id = ? AND type = 3", (department_id,))
            try:
                values_list = json.loads(values)
            except (TypeError, ValueError):
                values_list = []
            for idx, v in enumerate(values_list):
                title = str(v.get("title", "")).strip()
                desc = str(v.get("desc", "")).strip()
                if not title and not desc:
                    continue
                cursor.execute("""
                    INSERT INTO content (unity_id, label, description, type, ordre, icone)
                    VALUES (?, ?, ?, 3, ?, 'Layers')
                """, (department_id, title, desc, idx + 1))

        # Historique de la direction (content type = 7, ligne unique)
        if history_text is not None:
            cursor.execute("DELETE FROM content WHERE unity_id = ? AND type = 7", (department_id,))
            clean_history = history_text.strip()
            if clean_history:
                cursor.execute("""
                    INSERT INTO content (unity_id, description, type, ordre)
                    VALUES (?, ?, 7, 1)
                """, (department_id, clean_history))

        # Tableau de bord (indicateurs KPI + graphique) : upsert complet
        if dashboard is not None:
            try:
                dash_obj = json.loads(dashboard)
            except (TypeError, ValueError):
                dash_obj = None
            if dash_obj and dash_obj.get("title"):
                cursor.execute("SELECT id FROM dashboard WHERE unity_id = ?", (department_id,))
                exists = cursor.fetchone()
                params = (
                    dash_obj.get("title", ""),
                    dash_obj.get("subtitle", ""),
                    dash_obj.get("chartType", "area"),
                    json.dumps(dash_obj.get("kpis", [])),
                    json.dumps(dash_obj.get("series", [])),
                    json.dumps(dash_obj.get("chartData", []))
                )
                if exists:
                    cursor.execute("""
                        UPDATE dashboard SET title = ?, subtitle = ?, chart_type = ?, kpis = ?, series = ?, chart_data = ?
                        WHERE unity_id = ?
                    """, params + (department_id,))
                else:
                    cursor.execute("""
                        INSERT INTO dashboard (title, subtitle, chart_type, kpis, series, chart_data, unity_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, params + (department_id,))

        conn.commit()
        return {
            "status": "success",
            "message": "La direction a été enregistrée avec succès.",
            "data": {
                "id": department_id,
                "code": clean_code,
                "logo_path": logo_path
            }
        }
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur d'écriture base de données : {str(e)}"
        )
    finally:
        conn.close()


@router.get("/settings")
def get_admin_settings():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM settings")
        rows = cursor.fetchall()
        settings_dict = {}
        for row in rows:
            settings_dict[row["key"]] = row["value"]
        return {"status": "success", "data": settings_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/settings/save")
def save_admin_settings(settings: dict, admin_auth: dict = Depends(require_role('administrateur'))):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        for k, v in settings.items():
            cursor.execute("""
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (k, str(v)))
        conn.commit()
        return {"status": "success", "message": "Paramètres sauvegardés"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/applications")
def list_admin_applications():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description, url, icon, logo_url, is_global, category FROM applications")
        rows = cursor.fetchall()
        apps = []
        for r in rows:
            # Récupérer l'unité liée si non globale
            cursor.execute("SELECT unity_id FROM unity_applications WHERE application_id = ?", (r["id"] if isinstance(r, dict) else r[0],))
            ua_row = cursor.fetchone()
            dept_id = ua_row["unity_id"] if ua_row else None

            apps.append({
                "id": r["id"] if isinstance(r, dict) else r[0],
                "name": r["name"] if isinstance(r, dict) else r[1],
                "description": r["description"] if isinstance(r, dict) else r[2],
                "url": r["url"] if isinstance(r, dict) else r[3],
                "icon": r["icon"] if isinstance(r, dict) else r[4],
                "logoUrl": r["logo_url"] if isinstance(r, dict) else r[5],
                "isGlobal": bool(r["is_global"] if isinstance(r, dict) else r[6]),
                "category": r["category"] if isinstance(r, dict) else r[7],
                "departmentId": dept_id
            })
        return {"status": "success", "data": apps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/application/save")
def save_admin_application(
    id: Optional[int] = Form(None),
    name: str = Form(...),
    description: str = Form(...),
    url: str = Form(...),
    icon: str = Form("ExternalLink"),
    logo_url: Optional[str] = Form(None),
    isGlobal: bool = Form(False),
    category: str = Form(...),
    department_id: Optional[int] = Form(None),
    admin_auth: dict = Depends(require_role('administrateur'))
):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        is_global_int = 1 if isGlobal else 0
        if id:
            # Preserve existing logo_url when not explicitly overwritten
            if logo_url is None:
                cursor.execute("SELECT logo_url FROM applications WHERE id = ?", (id,))
                existing = cursor.fetchone()
                if existing:
                    logo_url = existing["logo_url"] if isinstance(existing, dict) else existing[0]

            cursor.execute("""
                UPDATE applications
                SET name = ?, description = ?, url = ?, icon = ?, logo_url = ?, is_global = ?, category = ?
                WHERE id = ?
            """, (name, description, url, icon, logo_url, is_global_int, category, id))
            app_id = id
        else:
            cursor.execute("""
                INSERT INTO applications (name, description, url, icon, logo_url, is_global, category)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (name, description, url, icon, logo_url, is_global_int, category))
            app_id = cursor.lastrowid

        # Gérer la liaison dans unity_applications
        cursor.execute("DELETE FROM unity_applications WHERE application_id = ?", (app_id,))
        if not isGlobal and department_id:
            cursor.execute("""
                INSERT INTO unity_applications (unity_id, application_id)
                VALUES (?, ?)
            """, (department_id, app_id))

        conn.commit()
        return {
            "status": "success",
            "message": "Application enregistrée",
            "data": {
                "id": app_id,
                "name": name,
                "description": description,
                "url": url,
                "icon": icon,
                "logoUrl": logo_url,
                "isGlobal": isGlobal,
                "category": category,
                "departmentId": department_id if not isGlobal else None
            }
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/application/{id}")
def delete_admin_application(id: int, admin_auth: dict = Depends(require_role('administrateur'))):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM applications WHERE id = ?", (id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Application non trouvée")
        cursor.execute("DELETE FROM applications WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Application supprimée"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/direction/{id}")
def delete_admin_direction(id: int, admin_auth: dict = Depends(require_role('administrateur'))):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM unity WHERE id = ?", (id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Direction non trouvée")
        cursor.execute("DELETE FROM unity WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Direction supprimée"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    admin_auth: dict = Depends(require_role('administrateur'))
):
    """
    Téléverse un fichier image ou document et retourne le chemin d'accès public.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Fichier invalide.")
        
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".docx", ".xlsx"}
    _, file_ext = os.path.splitext(file.filename.lower())
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Format de fichier non supporté."
        )

    MAX_SIZE = 5 * 1024 * 1024 # 5 MB
    size = 0
    temp_filename = f"file_{secrets.token_hex(8)}{file_ext}"
    temp_dest = os.path.join(UPLOAD_DIR, temp_filename)
    
    try:
        with open(temp_dest, "wb") as buffer:
            while chunk := await file.read(1024 * 64):
                size += len(chunk)
                if size > MAX_SIZE:
                    buffer.close()
                    if os.path.exists(temp_dest):
                        os.remove(temp_dest)
                    raise HTTPException(
                        status_code=400,
                        detail="Le fichier dépasse la limite de taille autorisée (5 Mo)."
                    )
                buffer.write(chunk)
        
        return {
            "status": "success",
            "url": f"uploads/{temp_filename}"
        }
    except Exception as e:
        if not isinstance(e, HTTPException):
            if os.path.exists(temp_dest):
                os.remove(temp_dest)
            raise HTTPException(status_code=500, detail=f"Erreur d'écriture de fichier: {str(e)}")
        raise e


@router.get("/projects")
def list_admin_projects():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.id, p.unity_id, p.label, p.description, p.image, p.date_debut, p.date_fin, p.niveau, p.type_id, tp.label as type_label, u.label as unity_label
            FROM projet p
            JOIN type_projet tp ON p.type_id = tp.id
            JOIN unity u ON p.unity_id = u.id
        """)
        rows = cursor.fetchall()
        projects = []
        for r in rows:
            projects.append({
                "id": r["id"],
                "unity_id": r["unity_id"],
                "unity_label": r["unity_label"],
                "label": r["label"],
                "description": r["description"],
                "image": r["image"],
                "date_debut": r["date_debut"],
                "date_fin": r["date_fin"],
                "niveau": r["niveau"],
                "type_id": r["type_id"],
                "type_label": r["type_label"]
            })
        return {"status": "success", "data": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/project/save")
def save_admin_project(
    id: Optional[int] = Form(None),
    unity_id: int = Form(...),
    label: str = Form(...),
    description: str = Form(...),
    image: str = Form(""),
    date_debut: str = Form(...),
    date_fin: str = Form(...),
    niveau: str = Form("En cours"),
    type_id: int = Form(...),
    current_user: dict = Depends(get_current_user)
):
    require_write_department(unity_id, current_user)
    description = sanitize_html(description)  # anti XSS stocké (description = HTML riche affiché tel quel)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if id:
            cursor.execute("SELECT unity_id FROM projet WHERE id = ?", (id,))
            existing = cursor.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Projet non trouvé")
            require_write_department(existing["unity_id"], current_user)
            cursor.execute("""
                UPDATE projet
                SET unity_id = ?, label = ?, description = ?, image = ?, date_debut = ?, date_fin = ?, niveau = ?, type_id = ?
                WHERE id = ?
            """, (unity_id, label, description, image, date_debut, date_fin, niveau, type_id, id))
            project_id = id
        else:
            cursor.execute("""
                INSERT INTO projet (unity_id, label, description, image, date_debut, date_fin, niveau, type_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (unity_id, label, description, image, date_debut, date_fin, niveau, type_id))
            project_id = cursor.lastrowid
        conn.commit()
        return {
            "status": "success",
            "message": "Projet enregistré avec succès",
            "data": {"id": project_id}
        }
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        if isinstance(e, HTTPException):
            raise e
        import traceback
        traceback.print_exc()
        try:
            with open("error.log", "a", encoding="utf-8") as f:
                f.write(f"--- PROJECT SAVE ERROR: {type(e).__name__} ---\n")
                traceback.print_exc(file=f)
                f.write("\n")
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erreur d'enregistrement : {type(e).__name__} - {str(e)}")
    finally:
        conn.close()


@router.delete("/project/{id}")
def delete_admin_project(id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, unity_id FROM projet WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Projet non trouvé")
        require_write_department(row["unity_id"], current_user)
        cursor.execute("DELETE FROM projet WHERE id = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Projet supprimé avec succès"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/recipients")
def list_admin_recipients():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.id, r.id_unity as unity_id, r.email, r.numero, r.raison, u.label as unity_label
            FROM recipient r
            JOIN unity u ON r.id_unity = u.id
        """)
        rows = cursor.fetchall()
        recipients = []
        for r in rows:
            cursor.execute("""
                SELECT email, numero FROM contact WHERE id_recipient = ?
            """, (r["id"],))
            contacts_rows = cursor.fetchall()
            associated_contacts = [{"email": c["email"], "numero": c["numero"]} for c in contacts_rows]
            
            recipients.append({
                "id": r["id"],
                "unity_id": r["unity_id"],
                "unity_label": r["unity_label"],
                "email": r["email"],
                "numero": r["numero"] or "",
                "raison": r["raison"] or "",
                "associated_contacts": associated_contacts
            })
        return {"status": "success", "data": recipients}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/recipient/save")
def save_admin_recipient(
    id: Optional[int] = Form(None),
    unity_id: int = Form(...),
    email: str = Form(...),
    numero: str = Form(""),
    raison: str = Form(""),
    associated_contacts_json: str = Form("[]"),
    current_user: dict = Depends(require_role('rh_direction', 'administrateur'))
):
    require_write_department(unity_id, current_user)
    import json
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if id:
            cursor.execute("SELECT id_unity FROM recipient WHERE id = ?", (id,))
            existing = cursor.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Destinataire non trouvé")
            require_write_department(existing["id_unity"], current_user)
            cursor.execute("""
                UPDATE recipient
                SET id_unity = ?, email = ?, numero = ?, raison = ?
                WHERE id = ?
            """, (unity_id, email, numero, raison, id))
            recipient_id = id
        else:
            cursor.execute("""
                INSERT INTO recipient (id_unity, email, numero, raison)
                VALUES (?, ?, ?, ?)
            """, (unity_id, email, numero, raison))
            recipient_id = cursor.lastrowid

        cursor.execute("DELETE FROM contact WHERE id_recipient = ?", (recipient_id,))
        try:
            contacts = json.loads(associated_contacts_json)
            for c in contacts:
                cursor.execute("""
                    INSERT INTO contact (id_recipient, email, numero)
                    VALUES (?, ?, ?)
                """, (recipient_id, c.get("email", ""), c.get("numero", "")))
        except Exception:
            pass

        conn.commit()
        return {
            "status": "success",
            "message": "Destinataire d'urgence enregistré avec succès",
            "data": {"id": recipient_id}
        }
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        if isinstance(e, HTTPException):
            raise e
        import traceback
        traceback.print_exc()
        try:
            with open("error.log", "a", encoding="utf-8") as f:
                f.write(f"--- ERROR: {type(e).__name__} ---\n")
                traceback.print_exc(file=f)
                f.write("\n")
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erreur d'enregistrement : {type(e).__name__} - {str(e)}")
    finally:
        conn.close()


@router.delete("/recipient/{id}")
def delete_admin_recipient(id: int, current_user: dict = Depends(require_role('rh_direction', 'administrateur'))):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, id_unity FROM recipient WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Destinataire non trouvé")
        require_write_department(row["id_unity"], current_user)
        cursor.execute("DELETE FROM recipient WHERE id = ?", (id,))
        cursor.execute("DELETE FROM contact WHERE id_recipient = ?", (id,))
        conn.commit()
        return {"status": "success", "message": "Destinataire d'urgence supprimé avec succès"}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
