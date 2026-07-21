#!/usr/bin/env bash
# Print the current public Cloudflare Tunnel URL (refreshes if needed).
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
bash "$WEB/deploy/watch-tunnel.sh" >/dev/null 2>&1 || true
if [[ -f "$WEB/data/public-url.txt" ]]; then
  cat "$WEB/data/public-url.txt"
  exit 0
fi
journalctl --user -u cloudflared-oca -n 80 --no-pager 2>/dev/null \
  | grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | tail -1
