"""Tests d'authentification : session cookie httpOnly, /me, logout, anti force-brute."""
from conftest import do_login, logged_client


def test_login_success_sets_httponly_cookie(client):
    r = do_login(client, "admin")
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == "administrateur"
    # Le jeton ne doit JAMAIS être renvoyé dans le corps (il reste dans le cookie httpOnly).
    assert "token" not in body
    set_cookie = r.headers.get("set-cookie", "")
    assert "edg_session=" in set_cookie
    assert "httponly" in set_cookie.lower()


def test_login_wrong_password_401(client):
    r = client.post("/api/auth/login", json={"email": "admin@edg.com.gn", "password": "faux"})
    assert r.status_code == 401


def test_me_requires_session(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_after_login(client):
    do_login(client, "chef")
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "chef@edg.com.gn"


def test_logout_clears_session(client):
    do_login(client, "admin")
    assert client.get("/api/auth/me").status_code == 200
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_account_locks_after_5_failed_attempts(client):
    # 4 échecs tolérés (401), le 5e bloque le compte (423).
    for _ in range(4):
        r = client.post("/api/auth/login", json={"email": "admin@edg.com.gn", "password": "faux"})
        assert r.status_code == 401
    r = client.post("/api/auth/login", json={"email": "admin@edg.com.gn", "password": "faux"})
    assert r.status_code == 423
    # Même avec le BON mot de passe, le compte reste bloqué.
    r = client.post("/api/auth/login", json={"email": "admin@edg.com.gn", "password": "administrateur"})
    assert r.status_code == 423


def test_successful_login_resets_failed_counter(client):
    # Quelques échecs puis une connexion réussie remet le compteur à zéro.
    for _ in range(3):
        client.post("/api/auth/login", json={"email": "chef@edg.com.gn", "password": "faux"})
    assert do_login(client, "chef").status_code == 200
    # Un nouvel échec isolé ne bloque pas (le compteur est reparti de zéro).
    r = client.post("/api/auth/login", json={"email": "chef@edg.com.gn", "password": "faux"})
    assert r.status_code == 401


def test_login_returns_must_change_password_flag(client):
    body = do_login(client, "admin").json()
    # Mots de passe de démo récents : pas de renouvellement forcé.
    assert body.get("mustChangePassword") is False


def test_change_password_enforces_strong_policy():
    """La politique forte (8 car. + majuscule + minuscule + chiffre) s'applique au mot de passe choisi par l'utilisateur."""
    from fastapi.testclient import TestClient
    from api.main import app
    admin = logged_client("admin")
    base = {"name": "Chg Test", "email": "chg.test@edg.com.gn", "role": "administrateur", "departmentId": None}
    r = admin.post("/api/admin/users", json={**base, "password": "TempPass123"})
    assert r.status_code == 200
    new_id = r.json()["id"]

    user = TestClient(app)
    assert user.post("/api/auth/login", json={"email": "chg.test@edg.com.gn", "password": "TempPass123"}).status_code == 200

    def change(cur, new):
        return user.post("/api/auth/change-password", json={"currentPassword": cur, "newPassword": new}).status_code

    assert change("TempPass123", "Ab1@") == 400             # trop court (< 12)
    assert change("TempPass123", "nouveaupass12@") == 400   # pas de majuscule
    assert change("TempPass123", "NOUVEAUPASS12@") == 400   # pas de minuscule
    assert change("TempPass123", "NouveauPasse@#") == 400   # pas de chiffre
    assert change("TempPass123", "NouveauPass123") == 400   # pas de caractère spécial
    assert change("TempPass123", "Nouvéau1234@#") == 400    # caractère accentué (é)
    assert change("faux", "NouveauPass12@") == 400          # mot de passe actuel erroné (mais mdp valide)
    assert change("TempPass123", "NouveauPass12@") == 200   # valide (12+, min/maj/chiffre/spécial, ASCII)

    admin.delete(f"/api/admin/users/{new_id}")


def test_change_password_requires_authentication(client):
    r = client.post("/api/auth/change-password", json={"currentPassword": "x", "newPassword": "MotDePasseFort9"})
    assert r.status_code == 401


def test_admin_can_set_simple_temp_password_and_forces_change():
    from fastapi.testclient import TestClient
    from api.main import app
    admin = logged_client("admin")
    base = {"name": "Compte Test", "email": "compte.test@edg.com.gn", "role": "administrateur", "departmentId": None}
    # Mot de passe temporaire vide -> refusé.
    assert admin.post("/api/admin/users", json={**base, "password": "   "}).status_code == 400
    # Mot de passe temporaire SIMPLE autorisé côté admin (peut être un mot de passe par défaut).
    r = admin.post("/api/admin/users", json={**base, "password": "edg2026"})
    assert r.status_code == 200
    new_id = r.json()["id"]
    # La première connexion EXIGE quand même un changement (activation), motif 'initial'.
    fresh = TestClient(app)
    r = fresh.post("/api/auth/login", json={"email": "compte.test@edg.com.gn", "password": "edg2026"})
    assert r.status_code == 200
    body = r.json()
    assert body.get("mustChangePassword") is True
    assert body.get("passwordChangeReason") == "initial"
    # Nettoyage du compte de test.
    admin.delete(f"/api/admin/users/{new_id}")
