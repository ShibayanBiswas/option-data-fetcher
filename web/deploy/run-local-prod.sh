#!/usr/bin/env bash
# Start Option Chain Archive on this PC for Cloudflare Tunnel.
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB"

export NODE_ENV=production
export PORT=3000
export HOSTNAME=127.0.0.1
set -a
# Prefer tunnel/production env (file SQLite). Never load Turso for this path.
if [[ -f .env.production ]]; then
  # shellcheck disable=SC1091
  source .env.production
fi
set +a
export LIBSQL_URL="${LIBSQL_URL:-file:./data/option_chain.db}"
# Force local file even if shell still has Turso from .env.local
case "${LIBSQL_URL}" in
  libsql://*|https://*)
    echo "Refusing Turso URL for PC tunnel deploy; using file:./data/option_chain.db"
    export LIBSQL_URL=file:./data/option_chain.db
    unset LIBSQL_AUTH_TOKEN TURSO_AUTH_TOKEN TURSO_DATABASE_URL || true
    ;;
esac

if [[ ! -f data/option_chain.db ]]; then
  echo "Missing data/option_chain.db"
  exit 1
fi

if [[ ! -f .next/standalone/server.js ]]; then
  echo "Building standalone server…"
  npm ci
  npm run build
  mkdir -p .next/standalone/.next .next/standalone/data
  cp -a public .next/standalone/
  cp -a .next/static .next/standalone/.next/
fi

# Keep DB path stable for standalone cwd
mkdir -p .next/standalone/data
ln -sfn "$WEB/data/option_chain.db" .next/standalone/data/option_chain.db
# Copy env into standalone dir for relative file:./data/...
cp -f .env.production .next/standalone/.env.production 2>/dev/null || true

cd .next/standalone
export LIBSQL_URL=file:./data/option_chain.db
exec /usr/local/bin/node server.js
