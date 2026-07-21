#!/usr/bin/env bash
# Reinstall hardened app + tunnel services + wake/health watcher.
# After lock/sleep, watcher restarts cloudflared and writes the new URL to data/public-url.txt
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$UNIT_DIR" "$WEB/data"
chmod +x "$WEB/deploy/"*.sh
loginctl enable-linger "$USER" 2>/dev/null || true

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
Description=Cloudflare Tunnel → Option Chain Archive
After=network-online.target oca-local.service
Wants=network-online.target
Requires=oca-local.service

[Service]
Type=simple
ExecStart=$HOME/.local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000
Restart=always
RestartSec=8
# Kill stuck reconnect loops after long sleep (force fresh quick tunnel)
WatchdogSec=0
TimeoutStartSec=60

[Install]
WantedBy=default.target
EOF

cat > "$UNIT_DIR/oca-tunnel-watch.service" <<EOF
[Unit]
Description=Option Chain Archive tunnel health check / auto-heal
After=oca-local.service cloudflared-oca.service

[Service]
Type=oneshot
ExecStart=/bin/bash "$WEB/deploy/watch-tunnel.sh"
EOF

# Every 2 minutes + shortly after boot; Persistent catches missed ticks after sleep.
cat > "$UNIT_DIR/oca-tunnel-watch.timer" <<EOF
[Unit]
Description=Heal Cloudflare tunnel after lock/sleep/network blips

[Timer]
OnBootSec=45s
OnUnitActiveSec=2min
Persistent=true
Unit=oca-tunnel-watch.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable oca-local.service cloudflared-oca.service oca-tunnel-watch.timer
systemctl --user restart oca-local.service
sleep 10
systemctl --user restart cloudflared-oca.service
sleep 6
systemctl --user enable --now oca-tunnel-watch.timer
systemctl --user start oca-tunnel-watch.service || true

# Wait for healthy URL
URL=""
for _ in $(seq 1 30); do
  sleep 2
  if [[ -f "$WEB/data/public-url.txt" ]]; then
    URL="$(tr -d '[:space:]' <"$WEB/data/public-url.txt")"
  fi
  if [[ -z "$URL" ]]; then
    URL="$(journalctl --user -u cloudflared-oca -n 80 --no-pager 2>/dev/null \
      | grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1 || true)"
  fi
  if [[ -n "$URL" ]] && curl -fsS --max-time 15 "$URL/api/sync" >/dev/null 2>&1; then
    echo "$URL" >"$WEB/data/public-url.txt"
    break
  fi
  URL=""
done

echo ""
echo "==> Services:"
systemctl --user is-active oca-local cloudflared-oca
systemctl --user --no-pager list-timers oca-tunnel-watch.timer
echo ""
if [[ -n "$URL" ]]; then
  echo "==> LIVE URL (bookmark / share this; old trycloudflare hostnames die after restart):"
  echo "    $URL"
  echo "    Also saved to: $WEB/data/public-url.txt"
else
  echo "==> URL not ready yet. Run: bash $WEB/deploy/watch-tunnel.sh"
  echo "    or: cat $WEB/data/public-url.txt"
fi
