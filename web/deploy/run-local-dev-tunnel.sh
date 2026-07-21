#!/usr/bin/env bash
# Fast local serve for Cloudflare Tunnel (next dev — lower memory than production build).
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"

export NODE_ENV=development
export PORT=3000
export HOSTNAME=127.0.0.1
export SQLITE_URL=file:./data/option_chain.db
export LIBSQL_URL=file:./data/option_chain.db
unset LIBSQL_AUTH_TOKEN TURSO_AUTH_TOKEN TURSO_DATABASE_URL 2>/dev/null || true

if [[ -f .env.production ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi
export SQLITE_URL=file:./data/option_chain.db
export LIBSQL_URL=file:./data/option_chain.db
unset LIBSQL_AUTH_TOKEN 2>/dev/null || true

exec /usr/local/bin/npx next dev --hostname 127.0.0.1 --port 3000
