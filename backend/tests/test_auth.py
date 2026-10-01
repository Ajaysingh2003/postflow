def test_register_login_and_me(client):
    registered = client.post(
        "/api/v1/auth/register",
        json={"email": "person@example.com", "password": "correct horse battery", "name": "Person"},
    )
    assert registered.status_code == 201
    token = registered.json()["access_token"]

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "person@example.com"

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "PERSON@example.com", "password": "correct horse battery"},
    )
    assert login.status_code == 200


def test_duplicate_registration_is_rejected(client):
    payload = {"email": "person@example.com", "password": "correct horse battery", "name": "Person"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409


def test_update_me(client):
    registered = client.post(
        "/api/v1/auth/register",
        json={"email": "update@example.com", "password": "correct horse battery", "name": "Initial Name"},
    )
    assert registered.status_code == 201
    token = registered.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {token}"}

    updated = client.patch(
        "/api/v1/auth/me",
        headers=auth_header,
        json={"name": "New Name"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "New Name"

    me = client.get("/api/v1/auth/me", headers=auth_header)
    assert me.status_code == 200
    assert me.json()["name"] == "New Name"

