"""Test anti XSS stocké : le contenu riche d'une actualité est assaini à l'enregistrement."""
from conftest import logged_client


def test_article_content_is_sanitized():
    chef = logged_client("chef")
    own = chef.get("/api/auth/me").json()["user"]["departmentId"]
    payload = {
        "title": "XSS",
        "excerpt": "x",
        "content": '<p>Bonjour</p><script>alert(1)</script><img src=x onerror="alert(2)">',
        "tags": [],
        "isGlobal": False,
        "departmentId": own,
        "image": "",
        "files": [],
    }
    r = chef.post("/api/articles", json=payload)
    assert r.status_code == 200
    content = r.json()["content"]
    assert "<script" not in content
    assert "onerror" not in content
    assert "<p>Bonjour</p>" in content  # la mise en forme légitime est conservée
    chef.delete(f"/api/articles/{r.json()['id']}")
