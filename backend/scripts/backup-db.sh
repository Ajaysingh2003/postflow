#!/bin/sh
set -eu
umask 077
backend_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_dir=${DRAFTVA_BACKUP_DIR:-"$backend_dir/deploy/state/backups"}
mkdir -p "$backup_dir"
# BSD/macOS mktemp requires the random placeholder at the end of the template.
backup_file=$(mktemp "$backup_dir/draftva-$(date -u +%Y%m%dT%H%M%SZ).dump-XXXXXX")
trap 'rm -f "$backup_file"' HUP INT TERM EXIT
sh "$backend_dir/scripts/compose-prod.sh" exec -T postgres \
    pg_dump --username=app --dbname=draftva --format=custom --no-owner --no-acl > "$backup_file"
test -s "$backup_file"
trap - HUP INT TERM EXIT
printf 'Database backup written to %s\n' "$backup_file"
