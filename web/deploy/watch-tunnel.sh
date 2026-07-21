#!/usr/bin/env bash
# Health-check Cloudflare quick tunnel. Restart if dead after lock/sleep/network blip.
# Writes the live URL to data/public-url.txt (hostname changes on restart).
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
URL_FILE="$WEB/data/public-url.txt"
LOG="$WEB/data/tunnel-watch.log"
LOCAL="http://127.0.0.1:3000/api/sync"
CF="$HOME/.local/bin/cloudflared"

mkdir -p "$WEB/data"
ts() { date -Is; }

log() { echo "$(ts) $*" >>"$LOG"; }

# Ensure local app is up
if ! curl -fsS --max-time 8 "$LOCAL" >/dev/null 2>&1; then
  log "local app down — restarting oca-local"
  systemctl --user restart oca-local.service || true
  sleep 12
fi

extract_url() {
  journalctl --user -u cloudflared-oca.service -n 120 --no-pager 2>/dev/null \
    | grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' \
    | tail -1 || true
}

tunnel_ok() {
  local url="$1"
  [[ -n "$url" ]] || return 1
  curl -fsS --max-time 20 "$url/api/sync" >/dev/null 2>&1
}

URL="$(extract_url)"
if [[ -z "$URL" ]] && [[ -f "$URL_FILE" ]]; then
  URL="$(tr -d '[:space:]' <"$URL_FILE" || true)"
fi

if tunnel_ok "$URL"; then
  echo "$URL" >"$URL_FILE"
  # Quiet success — only log occasionally via size check skipped
  exit 0
fi

log "tunnel unhealthy (url=${URL:-none}) — restarting cloudflared-oca"
systemctl --user restart cloudflared-oca.service || true

# Wait for new quick-tunnel registration
NEW=""
for _ in $(seq 1 24); do
  sleep 2
  NEW="$(extract_url)"
  if tunnel_ok "$NEW"; then
    echo "$NEW" >"$URL_FILE"
    log "tunnel restored: $NEW"
    echo "$NEW"
    exit 0
  fi
done

log "tunnel still unhealthy after restart"
exit 1
