#!/bin/sh
set -eu

if [ "${1:-}" = "api" ]; then
  exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --proxy-headers \
    --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}" \
    --no-access-log
fi

if [ "${1:-}" = "migrate" ]; then
  exec alembic upgrade head
fi

if [ "${1:-}" = "worker" ] || [ "${1:-}" = "scheduler" ]; then
  exec python -c "from app.jobs.runner import run; run('${1}')"
fi

exec "$@"
