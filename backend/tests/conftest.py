# ruff: noqa: I001

import os
import tempfile

import pytest
from fastapi.testclient import TestClient


database_fd, database_path = tempfile.mkstemp(suffix=".db")
os.close(database_fd)
os.environ["APP_ENV"] = "test"
test_database = os.environ.get("draftva_TEST_DATABASE_URL")
from sqlalchemy.engine import make_url

if test_database and make_url(test_database).database != "draftva_test":
    raise RuntimeError("The external test database must be named draftva_test")
os.environ["DATABASE_URL"] = test_database or f"sqlite:///{database_path}"
os.environ["APP_SECRET"] = "test-secret-that-is-long-enough-for-tests"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["LLM_MOCK_ENABLED"] = "true"
os.environ["SMTP_HOST"] = ""
os.environ["RESEND_API_KEY"] = ""
# Feature tests use existing unverified fixtures; auth tests explicitly exercise enforcement.
os.environ["EMAIL_VERIFICATION_REQUIRED"] = "false"

from app.db import models as _models  # noqa: F401
from app.db.base import Base
from app.db.session import engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "owner@example.com", "password": "correct horse battery", "name": "Owner"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
