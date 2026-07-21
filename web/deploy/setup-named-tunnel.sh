#!/usr/bin/env bash
# Optional: permanent hostname on your Cloudflare zone (not trycloudflare).
# Prerequisites: cloudflared tunnel login  (opens browser once)
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${TUNNEL_NAME:-option-chain-archive}"
HOSTNAME="${TUNNEL_HOSTNAME:?Set TUNNEL_HOSTNAME e.g. archive.yourdomain.com}"

cloudflared tunnel login
cloudflared tunnel create "${NAME}" || true
cloudflared tunnel route dns "${NAME}" "${HOSTNAME}"

CRED="$(ls -1 "${HOME}/.cloudflared/"*.json 2>/dev/null | head -1 || true)"
if [[ -z "${CRED}" ]]; then
  echo "No credentials JSON found in ~/.cloudflared after login"
  exit 1
fi
TUNNEL_ID="$(basename "${CRED}" .json)"

CFG="${HOME}/.cloudflared/config.yml"
cat > "${CFG}" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CRED}

ingress:
  - hostname: ${HOSTNAME}
    service: http://127.0.0.1:3000
  - service: http_status:404
EOF

echo "Wrote ${CFG}"
echo "Start app:  bash ${WEB}/deploy/start-local-tunnel.sh   # or keep app-only and run:"
echo "  cloudflared tunnel run ${NAME}"
echo "Public URL: https://${HOSTNAME}"
