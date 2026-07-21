#!/usr/bin/env bash
# Start Option Chain Archive on this PC (local SQLite) + Cloudflare quick tunnel.
# Usage: bash web/deploy/start-local-tunnel.sh
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
cd "${WEB}"

DB="${WEB}/data/option_chain.db"
if [[ ! -f "${DB}" ]]; then
  echo "Missing ${DB}"
  exit 1
fi

# Force local file DB — ignore any Turso vars from the shell
unset LIBSQL_AUTH_TOKEN TURSO_AUTH_TOKEN TURSO_DATABASE_URL || true
export LIBSQL_URL="file:${DB}"
export NODE_ENV=production
export PORT=3000
export HOSTNAME=0.0.0.0

if [[ ! -f .env.tunnel ]]; then
  cp .env.tunnel.example .env.tunnel 2>/dev/null || true
fi

echo "==> Ensuring archive_stats on local DB"
npx tsx --env-file=.env.tunnel scripts/push-archive-stats.ts || \
  LIBSQL_URL="file:${DB}" npx tsx scripts/push-archive-stats.ts

if [[ ! -d .next/standalone ]]; then
  echo "==> Building Next.js (standalone)…"
  npm run build
  mkdir -p .next/standalone/.next .next/standalone/data
  cp -a public .next/standalone/
  cp -a .next/static .next/standalone/.next/
fi

# Keep DB path reachable from standalone cwd
mkdir -p .next/standalone/data
ln -sfn "${DB}" .next/standalone/data/option_chain.db

LOG_DIR="${WEB}/data/tunnel-logs"
mkdir -p "${LOG_DIR}"

# Stop previous instances we own
if [[ -f "${LOG_DIR}/oca.pid" ]] && kill -0 "$(cat "${LOG_DIR}/oca.pid")" 2>/dev/null; then
  echo "==> Stopping previous app pid $(cat "${LOG_DIR}/oca.pid")"
  kill "$(cat "${LOG_DIR}/oca.pid")" 2>/dev/null || true
  sleep 1
fi
if [[ -f "${LOG_DIR}/tunnel.pid" ]] && kill -0 "$(cat "${LOG_DIR}/tunnel.pid")" 2>/dev/null; then
  echo "==> Stopping previous tunnel pid $(cat "${LOG_DIR}/tunnel.pid")"
  kill "$(cat "${LOG_DIR}/tunnel.pid")" 2>/dev/null || true
  sleep 1
fi

echo "==> Starting app on :3000"
cd .next/standalone
LIBSQL_URL="file:./data/option_chain.db" \
NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 \
  nohup node server.js > "${LOG_DIR}/oca.log" 2>&1 &
echo $! > "${LOG_DIR}/oca.pid"
cd "${WEB}"

# Wait for health
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:3000/api/sync" >/dev/null 2>&1; then
    echo "==> App is up"
    break
  fi
  sleep 1
  if [[ "$i" -eq 40 ]]; then
    echo "App failed to start. Tail:"
    tail -40 "${LOG_DIR}/oca.log"
    exit 1
  fi
done

CLOUDFLARED="$(command -v cloudflared || true)"
if [[ -z "${CLOUDFLARED}" ]]; then
  echo "cloudflared not found"
  exit 1
fi

echo "==> Starting Cloudflare quick tunnel → http://127.0.0.1:3000"
# Quick tunnel: free trycloudflare.com URL (changes each restart)
nohup "${CLOUDFLARED}" tunnel --url "http://127.0.0.1:3000" --no-autoupdate \
  > "${LOG_DIR}/tunnel.log" 2>&1 &
echo $! > "${LOG_DIR}/tunnel.pid"

echo "==> Waiting for public URL…"
URL=""
for i in $(seq 1 30); do
  URL="$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "${LOG_DIR}/tunnel.log" | tail -1 || true)"
  if [[ -n "${URL}" ]]; then
    break
  fi
  sleep 1
done

echo ""
echo "============================================"
echo " Local archive is public via Cloudflare Tunnel"
echo " App log:    ${LOG_DIR}/oca.log"
echo " Tunnel log: ${LOG_DIR}/tunnel.log"
echo " Stop with:  bash web/deploy/stop-local-tunnel.sh"
if [[ -n "${URL}" ]]; then
  echo " PUBLIC URL: ${URL}"
  echo "${URL}" > "${LOG_DIR}/public-url.txt"
else
  echo " URL not parsed yet — check: tail -f ${LOG_DIR}/tunnel.log"
fi
echo " NOTE: Machine must stay awake. Quick URL changes on restart."
echo " For a fixed domain: bash web/deploy/setup-named-tunnel.sh"
echo "============================================"
