"""Tests RBAC : gardes de rôle + cloisonnement par direction (le cœur de la sécurité métier)."""
from conftest import logged_client


def _make_article_payload(department_id, is_global=False):
    return {
        "title": "Test RBAC",
        "excerpt": "x",
        "content": "<p>contenu</p>",
        "tags": [],
        "isGlobal": is_global,
        "departmentId": department_id,
        "image": "",
        "files": [],
    }


def test_agent_cannot_list_users():
    agent = logged_client("agent")
    assert agent.get("/api/admin/users").status_code == 403


def test_admin_can_list_users():
    admin = logged_client("admin")
    r = admin.get("/api/admin/users")
    assert r.status_code == 200
    assert "items" in r.json()


def test_agent_cannot_create_article():
    agent = logged_client("agent")
    me = agent.get("/api/auth/me").json()["user"]
    r = agent.post("/api/articles", json=_make_article_payload(me["departmentId"]))
    assert r.status_code == 403


def test_chef_cannot_write_other_department():
    chef = logged_client("chef")
    own = chef.get("/api/auth/me").json()["user"]["departmentId"]
    depts = chef.get("/api/departments").json()
    other = next(d["id"] for d in depts if d["id"] != own)
    r = chef.post("/api/articles", json=_make_article_payload(other))
    assert r.status_code == 403


def test_chef_can_write_own_department():
    chef = logged_client("chef")
    own = chef.get("/api/auth/me").json()["user"]["departmentId"]
    r = chef.post("/api/articles", json=_make_article_payload(own))
    assert r.status_code == 200
    # Nettoyage : on supprime l'article créé.
    chef.delete(f"/api/articles/{r.json()['id']}")
