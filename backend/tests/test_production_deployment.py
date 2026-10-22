import base64
import importlib.util
import json
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from dotenv import dotenv_values
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy.exc import SQLAlchemyError

from app.core import health
from app.core.config import Settings
from app.core.production import audit

BACKEND = Path(__file__).resolve().parents[1]
PASSWORD = "4c" * 32


def production_settings(**overrides):
    values = {
        "app_env": "production",
        "app_secret": "2a" * 32,
        "auth_proxy_secret": "3b" * 32,
        "token_encryption_key": base64.urlsafe_b64encode(b"t" * 32).decode(),
        "database_url": f"postgresql+psycopg://app:{PASSWORD}@postgres:5432/draftva",
        "redis_url": "redis://redis:6379/0",
        "frontend_url": "https://draftva.com",
        "public_backend_url": "https://api.draftva.com",
        "oauth_redirect_base_url": "https://api.draftva.com/api/v1/channels/{platform}/callback",
        "cors_origins": "https://draftva.com",
        "email_verification_required": True,
        "rate_limit_enabled": True,
        "llm_mock_enabled": False,
        "dodo_api_base": "https://live.dodopayments.com",
        "dodo_api_key": "live-test-fixture",
        "dodo_webhook_secret": "whsec_" + base64.b64encode(b"w" * 32).decode(),
        "dodo_return_url": "https://draftva.com/settings/billing",
        "dodo_product_starter": "pdt_fixture_starter",
        "dodo_product_pro": "pdt_fixture_pro",
        "dodo_product_business": "pdt_fixture_business",
        "resend_api_key": "re_fixture",
        "resend_from_email": "Draftva <noreply@draftva.com>",
        "llm_provider_url": "https://model.invalid/generate",
        "llm_provider_api_key": "fixture-provider-key",
        "llm_model": "fixture-model",
        "r2_account_id": "fixture-account",
        "r2_access_key_id": "fixture-access",
        "r2_secret_access_key": "fixture-secret",
        "r2_bucket_name": "fixture-bucket",
        "r2_public_url": "https://media.draftva.com",
        "clamav_host": "clamav",
    }
    return Settings(_env_file=None, **{**values, **overrides})


def test_preflight_accepts_complete_configuration_without_claiming_live_validation():
    findings = audit(production_settings(), {"POSTGRES_PASSWORD": PASSWORD})
    assert not [item for item in findings if not item.warning]
    assert any(item.code == "LIVE_CHECKS" for item in findings)


@pytest.mark.parametrize(
    ("update", "code"),
    [
        ({"dodo_api_base": "https://test.dodopayments.com"}, "DODO_API_BASE"),
        ({"dodo_webhook_secret": "bad"}, "DODO_WEBHOOK_SECRET"),
        ({"dodo_product_business": None}, "DODO_PRODUCT_BUSINESS"),
        ({"public_backend_url": "http://localhost:18000"}, "PUBLIC_BACKEND_URL"),
        ({"cors_origins": "*"}, "CORS_ORIGINS"),
        ({"database_url": "sqlite:///local.db"}, "DATABASE_URL"),
        ({"database_url": "private-invalid-database-uri"}, "DATABASE_URL"),
        ({"token_encryption_key": "invalid"}, "TOKEN_ENCRYPTION_KEY"),
        ({"auth_proxy_secret": None}, "AUTH_PROXY_SECRET"),
        ({"llm_provider_api_key": None}, "LLM_PROVIDER_API_KEY"),
        ({"r2_public_url": "http://localhost/media"}, "R2_PUBLIC_URL"),
        ({"resend_api_key": None}, "SMTP_HOST"),
    ],
)
def test_preflight_rejects_launch_blockers(update, code):
    settings = production_settings().model_copy(update=update)
    assert code in {
        item.code for item in audit(settings, {"POSTGRES_PASSWORD": PASSWORD}) if not item.warning
    }


def test_preflight_rejects_spoofable_proxy_trust_and_wrong_provider_callbacks():
    settings = production_settings(
        x_client_id="fixture-id",
        x_client_secret="fixture-secret",
        oauth_redirect_base_url="https://draftva.com/api/v1/channels/{platform}/callback",
    )
    findings = audit(
        settings,
        {"POSTGRES_PASSWORD": PASSWORD, "FORWARDED_ALLOW_IPS": "*", "NGINX_CONFIG": "http"},
    )
    codes = {item.code for item in findings if not item.warning}
    assert {"FORWARDED_ALLOW_IPS", "NGINX_CONFIG", "CALLBACK_X"} <= codes
    findings = audit(settings, {"POSTGRES_PASSWORD": PASSWORD, "NGINX_PROXY_IP": "203.0.113.5"})
    assert "NGINX_PROXY_IP" in {item.code for item in findings}


def test_preflight_does_not_allow_mismatched_secrets_for_the_same_x_app():
    settings = production_settings(
        x_client_id="fixture-id",
        x_client_secret="one",
        x_login_client_id="fixture-id",
        x_login_client_secret="two",
    )
    assert "X_CLIENT_SECRET" in {
        item.code for item in audit(settings, {"POSTGRES_PASSWORD": PASSWORD})
    }


def test_environment_generator_is_private_preserves_external_blanks_and_refuses_overwrite(tmp_path):
    module_path = BACKEND / "scripts" / "init-production-env.py"
    spec = importlib.util.spec_from_file_location("init_production_env", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    destination = tmp_path / ".env"
    module.create_environment(destination)
    first = destination.read_bytes()
    assert stat.S_IMODE(destination.stat().st_mode) == 0o600
    values = dotenv_values(destination)
    assert len(values["POSTGRES_PASSWORD"]) == 64
    assert values["APP_SECRET"] != values["AUTH_PROXY_SECRET"]
    assert values["FACEBOOK_APP_SECRET"] == ""
    assert values["INSTAGRAM_APP_SECRET"] == ""
    assert values["THREADS_APP_SECRET"] == ""
    assert values["DODO_API_KEY"] == ""
    assert values["DATABASE_URL"].count(values["POSTGRES_PASSWORD"]) == 1
    with pytest.raises(FileExistsError):
        module.create_environment(destination)
    assert destination.read_bytes() == first


def test_generator_defaults_to_server_env_and_preserves_an_existing_file(tmp_path):
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    deploy = tmp_path / "deploy"
    deploy.mkdir()
    shutil.copy(BACKEND / "scripts/init-production-env.py", scripts)
    shutil.copy(BACKEND / "deploy/production.env.example", deploy)
    command = [sys.executable, str(scripts / "init-production-env.py")]
    result = subprocess.run(command, capture_output=True, text=True, check=False, timeout=10)
    assert result.returncode == 0, result.stderr
    destination = tmp_path / ".env"
    first = destination.read_bytes()
    assert stat.S_IMODE(destination.stat().st_mode) == 0o600
    assert not (tmp_path / ".env.production").exists()
    result = subprocess.run(command, capture_output=True, text=True, check=False, timeout=10)
    assert result.returncode != 0
    assert "refusing to replace" in result.stderr
    assert destination.read_bytes() == first


def test_renewal_uses_backend_env_by_default_from_another_directory(tmp_path):
    scripts = tmp_path / "server/backend/scripts"
    scripts.mkdir(parents=True)
    for name in ("compose-prod.sh", "renew-tls.sh"):
        shutil.copy(BACKEND / "scripts" / name, scripts)
    server_env = scripts.parent / ".env"
    server_env.write_text("APP_ENV=production\n")
    binary = tmp_path / "bin"
    binary.mkdir()
    capture = tmp_path / "docker-args.jsonl"
    fake_docker = binary / "docker"
    fake_docker.write_text(
        f"#!{sys.executable}\n"
        "import json, os, sys\n"
        "with open(os.environ['DOCKER_ARGS_LOG'], 'a') as output:\n"
        "    output.write(json.dumps(sys.argv[1:]) + '\\n')\n"
    )
    fake_docker.chmod(0o755)
    environment = {key: value for key, value in os.environ.items() if key != "DRAFTVA_ENV_FILE"}
    environment.update(
        PATH=str(binary) + os.pathsep + os.environ["PATH"], DOCKER_ARGS_LOG=str(capture)
    )
    result = subprocess.run(
        ["sh", str(scripts / "renew-tls.sh")],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    calls = [json.loads(line) for line in capture.read_text().splitlines()]
    assert len(calls) == 3
    for args in calls:
        assert args[args.index("--env-file") + 1] == str(server_env)
    assert "certbot" in calls[0] and "renew" in calls[0]
    assert calls[1][-2:] == ["nginx", "-t"]
    assert calls[2][-3:] == ["nginx", "-s", "reload"]


def test_preflight_cli_never_prints_invalid_settings_secrets(tmp_path):
    environment = tmp_path / "broken.env"
    marker = "PRIVATE_INVALID_SECRET_VALUE"
    environment.write_text(f"APP_ENV=production\nAPP_SECRET={marker}\n")
    result = subprocess.run(
        [sys.executable, "-m", "app.core.production", "--env-file", str(environment)],
        cwd=BACKEND,
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 1
    assert "FAIL SETTINGS" in result.stdout
    assert marker not in result.stdout + result.stderr


def test_readiness_fails_closed_on_database_and_redis_failures(client, monkeypatch, caplog):
    class BrokenDatabase:
        def connect(self):
            raise SQLAlchemyError("PRIVATE_DATABASE_CREDENTIALS")

    monkeypatch.setattr(health, "engine", BrokenDatabase())
    response = client.get("/ready")
    assert response.status_code == 503
    assert "PRIVATE" not in response.text + caplog.text
    assert client.get("/health").status_code == 200
    monkeypatch.undo()

    class BrokenRedis:
        @staticmethod
        def from_url(*args, **kwargs):
            assert kwargs == {"socket_connect_timeout": 2, "socket_timeout": 2}
            raise RedisConnectionError("PRIVATE_REDIS_CREDENTIALS")

    monkeypatch.setattr(
        health,
        "get_settings",
        lambda: SimpleNamespace(rate_limit_enabled=True, redis_url="redis://redis:6379/0"),
    )
    monkeypatch.setattr(health, "Redis", BrokenRedis)
    response = client.get("/ready")
    assert response.status_code == 503
    assert "PRIVATE" not in response.text + caplog.text


def test_real_compose_merge_exposes_only_nginx_and_uses_production_env(tmp_path):
    if not shutil.which("docker"):
        pytest.skip("Docker Compose CLI is needed to verify merge semantics")
    environment = tmp_path / "production.env"
    environment.write_text(f"APP_SECRET={'a' * 64}\nPOSTGRES_PASSWORD={PASSWORD}\n")
    result = subprocess.run(
        [
            "docker",
            "compose",
            "--env-file",
            str(environment),
            "-f",
            str(BACKEND / "compose.yaml"),
            "-f",
            str(BACKEND / "compose.prod.yaml"),
            "config",
            "--format",
            "json",
        ],
        env={
            "PATH": os.environ["PATH"],
            "HOME": os.environ.get("HOME", ""),
            "DRAFTVA_ENV_FILE": str(environment),
        },
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode == 0, result.stderr
    config = json.loads(result.stdout)
    assert config["name"] == "draftva-prod"
    services = config["services"]
    for name, service in services.items():
        if name != "nginx":
            assert not service.get("ports"), name
        if name in {"api", "migrate", "worker", "scheduler"}:
            assert service["environment"]["APP_ENV"] == "production"
            assert not service.get("volumes"), name
    assert {str(port["published"]) for port in services["nginx"]["ports"]} == {"80", "443"}
    assert services["api"]["environment"]["FORWARDED_ALLOW_IPS"] == "172.29.250.2"
    assert "/ready" in str(services["api"]["healthcheck"]["test"])
    assert services["nginx"]["depends_on"]["api"]["condition"] == "service_healthy"
    assert config["networks"]["default"]["name"] != "draftva_default"
    for service in services.values():
        assert service["logging"]["options"]["max-file"] == "5"


def test_production_settings_errors_do_not_include_secret_values():
    from pydantic import ValidationError

    marker = "PRIVATE_APP_SECRET"
    with pytest.raises(ValidationError) as raised:
        Settings(_env_file=None, app_env="production", app_secret=marker)
    assert marker not in str(raised.value)


@pytest.mark.parametrize(
    ("update", "expected"),
    [
        ({"database_url": "sqlite:///local.db"}, "PostgreSQL"),
        ({"cors_origins": "*"}, "CORS_ORIGINS"),
        ({"public_backend_url": "http://api.draftva.com"}, "HTTPS"),
        ({"dodo_api_base": "https://test.dodopayments.com"}, "live Dodo"),
    ],
)
def test_startup_itself_rejects_unsafe_production_configuration(update, expected):
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match=expected):
        production_settings(**update)


def test_backup_is_private_and_failed_dump_does_not_leave_a_partial_file(tmp_path):
    binary = tmp_path / "bin"
    binary.mkdir()
    fake_docker = binary / "docker"
    fake_docker.write_text(
        '#!/bin/sh\nif [ "${FAIL_BACKUP:-}" = 1 ]; then exit 7; fi\nprintf "fixture-backup"\n'
    )
    fake_docker.chmod(0o755)
    environment_file = tmp_path / "production.env"
    environment_file.write_text("APP_ENV=production\n")
    backup_dir = tmp_path / "backups"
    environment = {
        **os.environ,
        "PATH": str(binary) + os.pathsep + os.environ["PATH"],
        "DRAFTVA_ENV_FILE": str(environment_file),
        "DRAFTVA_BACKUP_DIR": str(backup_dir),
    }
    command = ["sh", str(BACKEND / "scripts/backup-db.sh")]
    result = subprocess.run(
        command, env=environment, check=False, capture_output=True, text=True, timeout=10
    )
    assert result.returncode == 0
    backups = list(backup_dir.glob("*.dump"))
    assert len(backups) == 1
    assert backups[0].read_text() == "fixture-backup"
    assert stat.S_IMODE(backups[0].stat().st_mode) == 0o600
    result = subprocess.run(
        command,
        env={**environment, "FAIL_BACKUP": "1"},
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode == 7
    assert list(backup_dir.glob("*.dump")) == backups
