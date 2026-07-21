#!/usr/bin/env bash
# Install user systemd units so the archive + tunnel start on login.
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${HOME}/.config/systemd/user"
mkdir -p "${UNIT_DIR}"

# Ensure scripts executable
chmod +x "${WEB}/deploy/start-local-tunnel.sh" "${WEB}/deploy/stop-local-tunnel.sh"

cat >"${UNIT_DIR}/oca-archive.service" <<EOF
[Unit]
Description=Option Chain Archive (local SQLite)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${WEB}/.next/standalone
EnvironmentFile=${WEB}/.env.tunnel
Environment=LIBSQL_URL=file:./data/option_chain.db
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Environment=NODE_ENV=production
Environment=PATH=${HOME}/.local/bin:/usr/bin:/bin
ExecStartPre=/bin/mkdir -p ${WEB}/.next/standalone/data
ExecStartPre=/bin/ln -sfn ${WEB}/data/option_chain.db ${WEB}/.next/standalone/data/option_chain.db
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

cat >"${UNIT_DIR}/oca-tunnel.service" <<EOF
[Unit]
Description=Cloudflare quick tunnel for Option Chain Archive
After=oca-archive.service
Requires=oca-archive.service

[Service]
Type=simple
Environment=PATH=${HOME}/.local/bin:/usr/bin:/bin
ExecStart=${HOME}/.local/bin/cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate
Restart=on-failure
RestartSec=5
StandardOutput=append:${HOME}/.config/oca/logs/tunnel.log
StandardError=append:${HOME}/.config/oca/logs/tunnel.log

[Install]
WantedBy=default.target
EOF

mkdir -p "${HOME}/.config/oca/logs"
systemctl --user daemon-reload
systemctl --user enable oca-archive.service oca-tunnel.service
echo "Enabled user services. Start with:"
echo "  systemctl --user start oca-archive oca-tunnel"
echo "Or one-shot without systemd:"
echo "  ${WEB}/deploy/start-local-tunnel.sh"
echo ""
echo "Enable lingering so services survive logout (optional, may need password):"
echo "  loginctl enable-linger \$USER"
