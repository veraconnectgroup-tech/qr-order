#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.vercel.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — run: vercel env pull .env.vercel.local" >&2
  exit 1
fi

SECRET="$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'")"
if [[ -z "$SECRET" ]]; then
  echo "CRON_SECRET empty in $ENV_FILE" >&2
  exit 1
fi

BASE="${DENIS_CRON_BASE:-https://qr-order-iota.vercel.app}"
PATH_CRON="${DENIS_CRON_PATH:-/api/cron/denis-session-watcher}"

echo "Paste this URL into cron-job.org (no headers needed):"
echo "${BASE}${PATH_CRON}?secret=${SECRET}"
echo ""
echo "Or header Authorization: Bearer ${SECRET}"
