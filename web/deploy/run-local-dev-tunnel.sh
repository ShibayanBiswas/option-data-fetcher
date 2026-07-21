#!/usr/bin/env bash
# Fast local serve for Cloudflare Tunnel (dev server — lower memory than next build).
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"

export NODE_ENV=development
export PORT=3000
export HOSTNAME=127.0.0.1
export LIBSQL_URL=file:./data/option_chain.db
unset LIBSQL_AUTH_TOKEN TURSO_AUTH_TOKEN TURSO_DATABASE_URL || true

if [[ -f .env.production ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi
export LIBSQL_URL=file:./data/option_chain.db
unset LIBSQL_AUTH_TOKEN || true

exec /usr/local/bin/npx next dev --hostname 127.0.0.1 --port 3000
