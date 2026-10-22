#!/bin/sh
set -eu
backend_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export NGINX_CONFIG=https
sh "$backend_dir/scripts/compose-prod.sh" run --rm --no-deps certbot renew \
    --quiet --webroot --webroot-path /var/www/certbot
sh "$backend_dir/scripts/compose-prod.sh" exec -T nginx nginx -t
sh "$backend_dir/scripts/compose-prod.sh" exec -T nginx nginx -s reload
