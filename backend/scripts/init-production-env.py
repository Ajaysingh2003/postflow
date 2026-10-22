#!/usr/bin/env python3
"""Create a private first-deployment env file. Never overwrite existing secrets."""

import argparse
import base64
import os
import secrets
from pathlib import Path


def create_environment(destination: Path) -> None:
    template = Path(__file__).resolve().parents[1] / "deploy" / "production.env.example"
    content = template.read_text()
    generated = {
        "APP_SECRET": secrets.token_hex(32),
        "POSTGRES_PASSWORD": secrets.token_hex(32),
        "AUTH_PROXY_SECRET": secrets.token_hex(32),
        "TOKEN_ENCRYPTION_KEY": base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),
    }
    content = (
        "\n".join(
            f"{key}={generated[key]}" if key in generated else line
            for line in content.splitlines()
            for key in [line.partition("=")[0]]
        )
        + "\n"
    )
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write(content)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / ".env")
    args = parser.parse_args()
    try:
        create_environment(args.output)
    except FileExistsError:
        parser.error("Environment file already exists; refusing to replace production secrets")
    print(
        "Created a private production environment file. Fill the provider credentials before preflight."
    )


if __name__ == "__main__":
    main()
