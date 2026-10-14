def test_email_verification_password_reset_and_sessions(client, auth, monkeypatch):
    sent_codes, reset_tokens = [], []
    monkeypatch.setattr(
        "app.modules.identity.mail.deliver_otp", lambda email, code, key: sent_codes.append(code)
    )
    monkeypatch.setattr(
        "app.modules.identity.mail.deliver_token",
        lambda email, token, purpose: reset_tokens.append(token),
    )
    verification = client.post("/api/v1/auth/email/request-verification", headers=auth)
    assert verification.status_code == 200
    token = sent_codes[0]
    verified = client.post(
        "/api/v1/auth/email/verify", json={"email": "owner@example.com", "token": token}
    )
    assert verified.status_code == 200

    client.post("/api/v1/auth/password/forgot", json={"email": "owner@example.com"})
    reset_token = reset_tokens[0]
    reset = client.post(
        "/api/v1/auth/password/reset",
        json={"token": reset_token, "password": "a newer secure password"},
    )
    assert reset.status_code == 200
    assert client.get("/api/v1/auth/me", headers=auth).status_code == 401
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "a newer secure password"},
    )
    assert login.status_code == 200


def test_posts_lifecycle_and_tenant_scoping(client, auth):
    created = client.post(
        "/api/v1/posts", headers=auth, json={"title": "Launch", "base_text": "Version one"}
    )
    assert created.status_code == 201, created.text
    post_id = created.json()["id"]
    assert created.json()["base_text"] == "Version one"

    updated = client.patch(
        f"/api/v1/posts/{post_id}", headers=auth, json={"base_text": "Version two"}
    )
    assert updated.status_code == 200
    assert updated.json()["base_text"] == "Version two"

    other = client.post(
        "/api/v1/auth/register",
        json={
            "email": "other@example.com",
            "password": "another secure password",
            "name": "Other",
        },
    ).json()
    other_auth = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get(f"/api/v1/posts/{post_id}", headers=other_auth).status_code == 404


def test_workspace_membership_and_selection(client, auth):
    assert client.get("/api/v1/workspaces/current", headers=auth).status_code == 200
    members = client.get("/api/v1/workspaces/current/members", headers=auth)
    assert members.json()[0]["role"] == "owner"
