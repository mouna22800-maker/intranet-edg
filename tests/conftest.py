"""
Configuration commune des tests backend (pytest + FastAPI TestClient).

IMPORTANT : on force une base SQLite temporaire et isolée AVANT tout import de l'application,
afin de ne jamais toucher la base de développement/production. Le schéma et les comptes de
démonstration sont créés une fois via init_db().
"""
import os
import tempfile

# --- Configuration de l'environnement de test (avant l'import de l'app) ---
_TEST_DB = os.path.join(tempfile.gettempdir(), "edg_test_intranet.db")
os.environ["SQLITE_DB_PATH"] = _TEST_DB
os.environ["DB_TYPE"] = "sqlite"
os.environ["MYSQL_HOST"] = ""  # force le repli SQLite (aucune tentative MySQL)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-for-production-0123456789")

if os.path.exists(_TEST_DB):
    os.remove(_TEST_DB)

import pytest
from fastapi.testclient import TestClient
from api.main import app
from api.database import init_db, get_db_connection
from api.routes import auth as auth_routes

# Crée le schéma + seed (directions, comptes de démo, etc.) dans la base de test.
init_db()

# Identifiants des comptes de démonstration (créés par le seed).
ACCOUNTS = {
    "agent": ("agent@edg.com.gn", "agent"),
    "chef": ("chef@edg.com.gn", "chef_service"),
    "rh": ("rh@edg.com.gn", "rh_direction"),
    "admin": ("admin@edg.com.gn", "administrateur"),
}


@pytest.fixture
def client():
    """Un client HTTP frais (jar de cookies isolé) par test."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def _reset_login_rate_limiter():
    """Réinitialise le limiteur anti force-brute IP entre chaque test (état en mémoire partagé)."""
    auth_routes._login_failures.clear()
    yield
    auth_routes._login_failures.clear()


@pytest.fixture(autouse=True)
def _reset_account_lockout():
    """Réinitialise le blocage de compte (persisté en base) entre chaque test, pour l'isolation."""
    def _clear():
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL")
            conn.commit()
        finally:
            conn.close()
    _clear()
    yield
    _clear()


def do_login(client, who):
    """Connecte `client` avec un compte de démo ('agent'|'chef'|'rh'|'admin'). Retourne la réponse."""
    email, password = ACCOUNTS[who]
    return client.post("/api/auth/login", json={"email": email, "password": password})


def logged_client(who):
    """Retourne un TestClient déjà authentifié pour le rôle demandé."""
    c = TestClient(app)
    r = do_login(c, who)
    assert r.status_code == 200, f"échec de connexion {who}: {r.status_code} {r.text}"
    return c
