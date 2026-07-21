#!/usr/bin/env bash
# Install a FIXED public URL via Cloudflare named tunnel (this PC + local SQLite).
#
# Prerequisites:
#   1) Free Cloudflare account
#   2) A domain added to Cloudflare (DNS managed by Cloudflare)
#   3) One browser login (script opens it)
#
# Usage:
#   TUNNEL_HOSTNAME=archive.yourdomain.com bash deploy/install-named-tunnel.sh
#
# Optional:
#   TUNNEL_NAME=option-chain-archive
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
CF="${HOME}/.local/bin/cloudflared"
NAME="${TUNNEL_NAME:-option-chain-archive}"
HOSTNAME="${TUNNEL_HOSTNAME:-}"

mkdir -p "$UNIT_DIR" "$WEB/data" "$HOME/.cloudflared"
chmod +x "$WEB/deploy/"*.sh
loginctl enable-linger "$USER" 2>/dev/null || true

if [[ -z "$HOSTNAME" ]]; then
  echo "ERROR: Set TUNNEL_HOSTNAME to a hostname on your Cloudflare domain."
  echo "Example:"
  echo "  TUNNEL_HOSTNAME=archive.yourdomain.com bash deploy/install-named-tunnel.sh"
  exit 1
fi

if [[ ! -x "$CF" ]]; then
  echo "cloudflared not found at $CF"
  exit 1
fi

# —— 1) Login (creates ~/.cloudflared/cert.pem) ——
if [[ ! -f "$HOME/.cloudflared/cert.pem" ]]; then
  echo "==> Opening Cloudflare login in your browser…"
  echo "    Authorize the domain that will host: $HOSTNAME"
  "$CF" tunnel login
fi

if [[ ! -f "$HOME/.cloudflared/cert.pem" ]]; then
  echo "Login did not create cert.pem — complete the browser step and re-run."
  exit 1
fi

# —— 2) Create named tunnel (idempotent) ——
echo "==> Ensuring tunnel: $NAME"
if ! "$CF" tunnel list 2>/dev/null | awk 'NR>1 {print $2}' | grep -qx "$NAME"; then
  "$CF" tunnel create "$NAME"
fi

TUNNEL_ID="$("$CF" tunnel list 2>/dev/null | awk -v n="$NAME" '$2==n {print $1; exit}')"
if [[ -z "$TUNNEL_ID" ]]; then
  echo "Could not resolve tunnel id for $NAME"
  "$CF" tunnel list || true
  exit 1
fi

CRED="$HOME/.cloudflared/${TUNNEL_ID}.json"
if [[ ! -f "$CRED" ]]; then
  # credentials file name is always <uuid>.json next to create
  CRED="$(ls -1 "$HOME/.cloudflared/"*.json 2>/dev/null | head -1 || true)"
fi
if [[ ! -f "$CRED" ]]; then
  echo "Missing credentials JSON for tunnel $TUNNEL_ID"
  exit 1
fi

# —— 3) DNS route (CNAME hostname → tunnel) ——
echo "==> Routing DNS: $HOSTNAME → tunnel $NAME ($TUNNEL_ID)"
"$CF" tunnel route dns --overwrite-dns "$NAME" "$HOSTNAME" || \
  "$CF" tunnel route dns "$NAME" "$HOSTNAME"

# —— 4) cloudflared config ——
CFG="$HOME/.cloudflared/config.yml"
cat > "$CFG" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CRED

ingress:
  - hostname: $HOSTNAME
    service: http://127.0.0.1:3000
  - service: http_status:404
EOF
echo "Wrote $CFG"

# —— 5) systemd: app + named tunnel + heal watcher ——
cat > "$UNIT_DIR/oca-local.service" <<EOF
[Unit]
Description=Option Chain Archive (local PC)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$WEB
ExecStart=/bin/bash "$WEB/deploy/run-local-dev-tunnel.sh"
Restart=always
RestartSec=5
Environment=NODE_ENV=development
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
Environment=SQLITE_URL=file:./data/option_chain.db
Environment=LIBSQL_URL=file:./data/option_chain.db

[Install]
WantedBy=default.target
EOF

cat > "$UNIT_DIR/cloudflared-oca.service" <<EOF
[Unit]
Description=Cloudflare named tunnel → Option Chain Archive
After=network-online.target oca-local.service
Wants=network-online.target
Requires=oca-local.service

[Service]
Type=simple
ExecStart=$CF tunnel --no-autoupdate --config $CFG run $NAME
Restart=always
RestartSec=8

[Install]
WantedBy=default.target
EOF

# Named tunnel keeps the same hostname — watcher only restarts if unhealthy.
cat > "$WEB/deploy/watch-named-tunnel.sh" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
URL_FILE="$WEB/data/public-url.txt"
LOG="$WEB/data/tunnel-watch.log"
mkdir -p "$WEB/data"
ts(){ date -Is; }
log(){ echo "$(ts) $*" >>"$LOG"; }
URL="$(tr -d '[:space:]' <"$URL_FILE" 2>/dev/null || true)"
[[ -n "$URL" ]] || exit 0
if ! curl -fsS --max-time 8 "http://127.0.0.1:3000/api/sync" >/dev/null 2>&1; then
  log "local down — restart oca-local"
  systemctl --user restart oca-local.service || true
  sleep 10
fi
if curl -fsS --max-time 20 "$URL/api/sync" >/dev/null 2>&1; then
  exit 0
fi
log "named tunnel unhealthy — restart cloudflared-oca"
systemctl --user restart cloudflared-oca.service || true
EOS
chmod +x "$WEB/deploy/watch-named-tunnel.sh"

cat > "$UNIT_DIR/oca-tunnel-watch.service" <<EOF
[Unit]
Description=Option Chain Archive named-tunnel health check
After=oca-local.service cloudflared-oca.service

[Service]
Type=oneshot
ExecStart=/bin/bash "$WEB/deploy/watch-named-tunnel.sh"
EOF

cat > "$UNIT_DIR/oca-tunnel-watch.timer" <<EOF
[Unit]
Description=Heal named Cloudflare tunnel after lock/sleep

[Timer]
OnBootSec=45s
OnUnitActiveSec=2min
Persistent=true
Unit=oca-tunnel-watch.service

[Install]
WantedBy=timers.target
EOF

FIXED_URL="https://${HOSTNAME}"
echo "$FIXED_URL" >"$WEB/data/public-url.txt"

systemctl --user daemon-reload
systemctl --user enable oca-local.service cloudflared-oca.service oca-tunnel-watch.timer
systemctl --user restart oca-local.service
sleep 10
systemctl --user restart cloudflared-oca.service
sleep 5
systemctl --user enable --now oca-tunnel-watch.timer

echo ""
echo "==> Fixed public URL:"
echo "    $FIXED_URL"
echo "    (saved to $WEB/data/public-url.txt)"
echo ""
# Probe
if curl -fsS --max-time 25 "$FIXED_URL/api/sync" >/dev/null 2>&1; then
  echo "==> Health: OK"
  curl -sS --max-time 25 "$FIXED_URL/api/sync"
  echo
else
  echo "==> DNS may still be propagating (1–5 min). Retry:"
  echo "    curl -I $FIXED_URL"
  echo "    systemctl --user status cloudflared-oca"
fi
