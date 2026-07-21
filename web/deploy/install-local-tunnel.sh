#!/usr/bin/env bash
# Install + start local PC services (app + Cloudflare quick tunnel).
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$UNIT_DIR"

chmod +x "$WEB/deploy/"*.sh
loginctl enable-linger "$USER" 2>/dev/null || true

# Paths with spaces must be quoted for systemd.
cat > "$UNIT_DIR/oca-local.service" <<EOF
[Unit]
Description=Option Chain Archive (local PC)
After=network.target

[Service]
Type=simple
WorkingDirectory=$WEB
ExecStart=/bin/bash "$WEB/deploy/run-local-dev-tunnel.sh"
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=development
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
Environment=LIBSQL_URL=file:./data/option_chain.db

[Install]
WantedBy=default.target
EOF

cat > "$UNIT_DIR/cloudflared-oca.service" <<EOF
[Unit]
Description=Cloudflare Tunnel → Option Chain Archive
After=network-online.target oca-local.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=$HOME/.local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable oca-local.service cloudflared-oca.service
systemctl --user restart oca-local.service
sleep 8
systemctl --user restart cloudflared-oca.service
sleep 5

echo ""
echo "==> App:"
systemctl --user --no-pager --full status oca-local.service | head -15
echo ""
echo "==> Public URL:"
journalctl --user -u cloudflared-oca.service -n 80 --no-pager \
  | grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1 \
  || echo "(wait a few seconds, then: journalctl --user -u cloudflared-oca -f)"
