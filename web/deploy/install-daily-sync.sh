#!/usr/bin/env bash
# Install weekday auto-sync for local SQLite (served by Cloudflare Tunnel).
# There is no separate Cloudflare database — one file, one sync job.
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$UNIT_DIR" "$WEB/data"
chmod +x "$WEB/deploy/run-daily-sync.sh"

loginctl enable-linger "$USER" 2>/dev/null || true

cat > "$UNIT_DIR/oca-daily-sync.service" <<EOF
[Unit]
Description=Option Chain Archive daily bhavcopy sync
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$WEB
ExecStart=/bin/bash "$WEB/deploy/run-daily-sync.sh"
Nice=10
EOF

# ~19:30 IST weekdays (after NSE/BSE settlement / UDiFF publish).
# Persistent=true: if the PC was asleep, run soon after wake.
cat > "$UNIT_DIR/oca-daily-sync.timer" <<EOF
[Unit]
Description=Weekday Option Chain Archive sync (~19:30 IST)

[Timer]
OnCalendar=Mon..Fri *-*-* 19:30:00 Asia/Kolkata
Persistent=true
Unit=oca-daily-sync.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now oca-daily-sync.timer

# Keep a matching crontab as backup (same job; timer is primary).
CRON_LINE="30 19 * * 1-5 /bin/bash \"$WEB/deploy/run-daily-sync.sh\""
# Remove old seed-backfill lines, then add ours
TMP="$(mktemp)"
(crontab -l 2>/dev/null | grep -v seed-backfill | grep -v run-daily-sync || true) >"$TMP"
echo "$CRON_LINE" >>"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo ""
echo "==> Daily sync installed (local SQLite = Cloudflare Tunnel data)"
echo "    Timer: weekdays 19:30 Asia/Kolkata (Persistent=true)"
echo "    Log:   $WEB/data/sync.log"
systemctl --user --no-pager list-timers oca-daily-sync.timer
echo ""
echo "Manual run: bash \"$WEB/deploy/run-daily-sync.sh\""
crontab -l | grep run-daily-sync || true
