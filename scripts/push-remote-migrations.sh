#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Set SUPABASE_DB_PASSWORD in .env.local or export it." >&2
  exit 1
fi

echo "Linking qr-order (pooler / IPv4)…"
npx supabase@latest link \
  --project-ref mcumfksxujgtjfjfwtpl \
  --password "$SUPABASE_DB_PASSWORD" \
  --yes

echo "Pushing pending migrations (session pooler + SSL)…"
DB_URL="postgresql://postgres.mcumfksxujgtjfjfwtpl:$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe=''))")@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"
npx supabase@latest db push --db-url "$DB_URL" --yes

echo "Migration status:"
npx supabase@latest migration list | tail -20
