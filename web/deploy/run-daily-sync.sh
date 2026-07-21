#!/usr/bin/env bash
# Daily bhavcopy → local SQLite. Cloudflare Tunnel reads this same file — no second DB.
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"
mkdir -p "$WEB/data"
export SQLITE_URL="${SQLITE_URL:-file:./data/option_chain.db}"
export LIBSQL_URL="$SQLITE_URL"
unset LIBSQL_AUTH_TOKEN TURSO_DATABASE_URL TURSO_AUTH_TOKEN 2>/dev/null || true

LOG="$WEB/data/sync.log"
{
  echo ""
  echo "======== $(date -Is) daily sync start ========"
  /usr/local/bin/npx tsx --env-file=.env.local scripts/seed-backfill.ts
  /usr/local/bin/npx tsx --env-file=.env.local scripts/push-archive-stats.ts
  echo "======== $(date -Is) daily sync done ========"
} >>"$LOG" 2>&1
