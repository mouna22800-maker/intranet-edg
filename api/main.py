import os
import logging
import mimetypes
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from api.database import init_db, UPLOAD_DIR

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("edg")

# Certains environnements Windows n'enregistrent pas le type MIME WebP par défaut.
# On le déclare explicitement (sinon servi en application/octet-stream, bloqué par nosniff).
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")
from api.routes import departments, articles, admin, team, tickets, uploads, auth, documents, users, user_notifications, events, postes

APP_ENV = os.getenv("APP_ENV", "development").lower()
IS_PROD = APP_ENV == "production"

app = FastAPI(
    title="Électricité de Guinée (EDG) S.A. - Intranet API Hub",
    description="Backend modulaire FastAPI en Python gérant le portail collaboratif institutionnel de l'EDG.",
    version="1.1.0",
    # En PRODUCTION, on désactive la documentation interactive (elle exposerait toute la surface de l'API).
    docs_url=None if IS_PROD else "/docs",
    redoc_url=None if IS_PROD else "/redoc",
    openapi_url=None if IS_PROD else "/openapi.json",
)

# --- CORS : origines autorisées RESTREINTES (plus de "*"). En prod, définir CORS_ORIGINS dans .env
# (ex: CORS_ORIGINS="https://intranet.edg.com.gn"). En dev, valeur par défaut = localhost:3000. ---
_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- En-têtes de sécurité appliqués à toutes les réponses ---
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if IS_PROD:
        # HSTS : n'a de sens qu'en HTTPS (production derrière TLS).
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# --- Gestion des erreurs : ne JAMAIS renvoyer le détail technique au client sur une 500 ---
@app.exception_handler(StarletteHTTPException)
async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
    headers = getattr(exc, "headers", None)
    if exc.status_code >= 500:
        # Le détail (souvent str(e)) est journalisé côté serveur, mais pas exposé au client.
        logger.error("Erreur %s sur %s : %s", exc.status_code, request.url.path, exc.detail)
        return JSONResponse(status_code=exc.status_code,
                            content={"detail": "Erreur interne du serveur. Veuillez réessayer plus tard."},
                            headers=headers)
    # Erreurs < 500 (401, 403, 404, 429...) : messages métier conservés tels quels.
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=headers)


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Exception non gérée sur %s", request.url.path)
    return JSONResponse(status_code=500,
                        content={"detail": "Erreur interne du serveur. Veuillez réessayer plus tard."})


# Attacher les routers (supportant les requêtes directes et préfixées par /api)
app.include_router(departments.router)
app.include_router(articles.router)
app.include_router(admin.router)
app.include_router(team.router)
app.include_router(tickets.router)
app.include_router(uploads.router)
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(users.router)
app.include_router(user_notifications.router)
app.include_router(events.router)
app.include_router(postes.router)

app.include_router(departments.router, prefix="/api")
app.include_router(articles.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(team.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(user_notifications.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(postes.router, prefix="/api")

# Sert les fichiers téléversés (images d'actualités, de projets, logos, documents...) en statique
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup_event():
    """Initialise le dossier d'upload, les tables et le seed lors du démarrage de l'API."""
    init_db()


@app.get("/api")
def api_root():
    return {
        "institution": "Électricité de Guinée (EDG) S.A.",
        "api_name": "EDG Intranet REST API Hub",
        "status": "online",
        "environment": APP_ENV,
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "EDG-FastAPI-Modular-Backend"}


# --- Sert le frontend COMPILÉ (dossier dist) s'il est présent : un seul processus (uvicorn) sert
# à la fois l'application React et l'API. Le routage étant par hash côté client (#…), le serveur
# n'a besoin de servir que "/", les assets et /images — pas de fallback SPA compliqué.
# En développement, dist n'existe pas : on utilise le serveur Vite (port 3000). ---
_DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
if _DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(_DIST_DIR), html=True), name="frontend")
