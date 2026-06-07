#!/usr/bin/env bash
# Denis pilot wiring — ping background ticks + checklist.
# Usage:
#   export CRON_SECRET='...'
#   export DOMAIN='https://qr-order-iota.vercel.app'   # optional
#   ./scripts/wire-denis-pilot.sh

set -euo pipefail

DOMAIN="${DOMAIN:-https://qr-order-iota.vercel.app}"
SKYLINE_LOC='b0000000-0000-4000-8000-000000000001'

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "ERROR: set CRON_SECRET (same value as Vercel env)."
  exit 1
fi

echo "== Denis pilot tick (no auth — expect 401) =="
curl -sS -o /dev/null -w "unauth:%{http_code}\n" \
  "${DOMAIN}/api/cron/denis-pilot-tick"

echo "== Denis pilot tick (with CRON_SECRET — expect 200) =="
curl -sS -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${DOMAIN}/api/cron/denis-pilot-tick"

echo ""
echo "== Checklist =="
echo "[ ] supabase db push applied 00117 (Skyline ai_concierge_enabled + config)"
echo "[ ] Vercel deploy includes /api/cron/denis-pilot-tick"
echo "[ ] External cron (cron-job.org) every 1 min:"
echo "    GET ${DOMAIN}/api/cron/denis-pilot-tick"
echo "    Header: Authorization: Bearer <CRON_SECRET>"
echo "[ ] Optional Vercel env: DENIS_ROLLOUT_MODE=denis_only (overrides per-location)"
echo "[ ] Admin /dashboard/denis — priority tables visible"
echo "[ ] Guest QR demo-table-1 — welcome chip ~30s"
echo ""
echo "Skyline LOC_ID: ${SKYLINE_LOC}"
