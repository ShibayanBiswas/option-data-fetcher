#!/usr/bin/env bash
# Start Option Chain Archive on this PC for Cloudflare Tunnel.
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"

export NODE_ENV=production
export PORT=3000
export HOSTNAME=127.0.0.1
unset LIBSQL_AUTH_TOKEN TURSO_AUTH_TOKEN TURSO_DATABASE_URL 2>/dev/null || true

set -a
if [[ -f .env.production ]]; then
  # shellcheck disable=SC1091
  source .env.production
elif [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  source .env.local
fi
set +a

export SQLITE_URL="${SQLITE_URL:-file:./data/option_chain.db}"
export LIBSQL_URL="${SQLITE_URL}"
case "${SQLITE_URL}${LIBSQL_URL}" in
  *libsql://*|*https://*)
    echo "Refusing remote DB URL; using file:./data/option_chain.db"
    export SQLITE_URL=file:./data/option_chain.db
    export LIBSQL_URL=file:./data/option_chain.db
    ;;
esac

if [[ ! -f data/option_chain.db ]]; then
  echo "Missing data/option_chain.db"
  exit 1
fi

if [[ ! -f .next/standalone/server.js ]]; then
  echo "No standalone build — use run-local-dev-tunnel.sh instead"
  exec /bin/bash "$WEB/deploy/run-local-dev-tunnel.sh"
fi

mkdir -p .next/standalone/.next .next/standalone/data
ln -sfn "$WEB/data/option_chain.db" .next/standalone/data/option_chain.db
cd .next/standalone
export SQLITE_URL=file:./data/option_chain.db
export LIBSQL_URL=file:./data/option_chain.db
exec /usr/local/bin/node server.js
