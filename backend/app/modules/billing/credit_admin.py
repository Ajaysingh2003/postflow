"""Operator-only CLI: python -m app.modules.billing.credit_admin --help.

Uses server database credentials, never an end-user API or provider credentials.
"""

import argparse
import json
import os

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.billing.credits import adjust, balance_for_update, summary
from app.modules.billing.models import AICreditEvent
from app.modules.identity.models import User
from app.modules.workspaces.models import Workspace


def parser():
    cli = argparse.ArgumentParser(description="Inspect and adjust Draftva workspace AI credits")
    cli.add_argument("action", choices=["balance", "grant", "reset", "audit", "backfill"])
    target = cli.add_mutually_exclusive_group()
    target.add_argument("--workspace")
    target.add_argument("--email", help="Owner email; requires exactly one owned workspace")
    cli.add_argument("--amount", type=int, default=0)
    cli.add_argument("--reason", default="")
    cli.add_argument("--actor", default=os.environ.get("USER", "operator"))
    cli.add_argument(
        "--key", help="Stable operation key; reuse it when retrying the same grant/reset"
    )
    return cli


def resolve_workspace(db, args):
    if args.workspace:
        return args.workspace
    if not args.email:
        raise ValueError("Specify --workspace or --email")
    ids = list(
        db.scalars(
            select(Workspace.id)
            .join(User, User.id == Workspace.owner_user_id)
            .where(User.email == args.email.strip().lower())
            .order_by(Workspace.id)
            .limit(2)
        )
    )
    if len(ids) != 1:
        raise ValueError("Owner must have exactly one workspace; otherwise specify --workspace")
    return ids[0]


def run(args):
    with SessionLocal() as db:
        if args.action == "backfill":
            cursor, count = "", 0
            while True:
                ids = list(
                    db.scalars(
                        select(Workspace.id)
                        .where(Workspace.id > cursor)
                        .order_by(Workspace.id)
                        .limit(100)
                    )
                )
                if not ids:
                    break
                for workspace_id in ids:
                    balance_for_update(db, workspace_id)
                    db.commit()
                    count += 1
                cursor = ids[-1]
            return {"initialized_or_refreshed": count}
        workspace_id = resolve_workspace(db, args)
        if args.action in {"grant", "reset"}:
            if not args.key:
                raise ValueError("--key is required so retrying an adjustment is safe")
            adjust(
                db,
                workspace_id,
                args.action,
                amount=args.amount,
                actor=args.actor,
                reason=args.reason,
                request_key=args.key,
            )
        if args.action == "audit":
            events = list(
                db.scalars(
                    select(AICreditEvent)
                    .where(AICreditEvent.workspace_id == workspace_id)
                    .order_by(AICreditEvent.created_at.desc(), AICreditEvent.id.desc())
                    .limit(100)
                )
            )
            return [
                {
                    "id": event.id,
                    "action": event.action,
                    "actor": event.actor,
                    "reason": event.reason,
                    "request_key": event.request_key,
                    "before": event.before,
                    "after": event.after,
                    "created_at": event.created_at.isoformat(),
                }
                for event in events
            ]
        balance, usage, info = summary(db, workspace_id)
        db.commit()
        return {
            "workspace_id": workspace_id,
            "cycle_start": balance.cycle_start.isoformat(),
            "cycle_end": balance.cycle_end.isoformat(),
            "ai_credits": usage,
            "details": info,
        }


def main():
    cli = parser()
    try:
        result = run(cli.parse_args())
    except Exception as error:  # noqa: BLE001 - redact database connection/SQL errors in terminal output
        # Do not dump connection URLs, SQL parameters or private provider data.
        from fastapi import HTTPException

        if isinstance(error, ValueError):
            cli.error(str(error))
        if isinstance(error, HTTPException):
            cli.error(str(error.detail))
        cli.error("Credit operation failed. Check database connectivity and migration status")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
