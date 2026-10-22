#!/bin/sh
set -eu
backend_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${DRAFTVA_ENV_FILE:-"$backend_dir/.env"}
case "$env_file" in
    /*) ;;
    *) env_file="$(pwd)/$env_file" ;;
esac
if [ ! -f "$env_file" ]; then
    echo 'Missing production environment file. See deploy/production.env.example.' >&2
    exit 1
fi
# Use the server's environment file for both interpolation and containers.
export DRAFTVA_ENV_FILE="$env_file"
exec docker compose --env-file "$env_file" \
    --project-directory "$backend_dir" \
    -f "$backend_dir/compose.yaml" -f "$backend_dir/compose.prod.yaml" "$@"
