"""Tests tickets : soumission publique + cloisonnement du traitement par direction."""
from fastapi.testclient import TestClient
from api.main import app
from conftest import logged_client


def _create_ticket(department_id):
    c = TestClient(app)  # soumission publique, sans authentification
    return c.post("/api/tickets", json={
        "type": "contact",
        "senderName": "Visiteur",
        "senderEmail": "visiteur@example.com",
        "subject": "Demande de test",
        "message": "Bonjour",
        "departmentId": department_id,
    })


def test_public_can_create_ticket():
    admin = logged_client("admin")
    dept = admin.get("/api/departments").json()[0]["id"]
    r = _create_ticket(dept)
    assert r.status_code == 200
    assert r.json()["id"].startswith("EDG-")
    admin.delete(f"/api/tickets/{r.json()['id']}")  # nettoyage


def test_chef_cannot_update_other_department_ticket():
    chef = logged_client("chef")
    own = chef.get("/api/auth/me").json()["user"]["departmentId"]
    depts = chef.get("/api/departments").json()
    other = next(d["id"] for d in depts if d["id"] != own)

    ticket_id = _create_ticket(other).json()["id"]
    # Le chef ne gère que sa direction : mise à jour d'un ticket d'une autre direction => 403.
    r = chef.patch(f"/api/tickets/{ticket_id}/status", json={"status": "En cours"})
    assert r.status_code == 403

    logged_client("admin").delete(f"/api/tickets/{ticket_id}")  # nettoyage
