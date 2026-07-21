#!/usr/bin/env bash
# Run on your LAPTOP after the VPS exists and your SSH key is on it.
#
#   export VPS_IP=1.2.3.4
#   export VPS_DOMAIN=archive.example.com   # optional
#   bash web/deploy/provision-from-laptop.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB="${ROOT}/web"
DB="${WEB}/data/option_chain.db"
VPS_IP="${VPS_IP:?Set VPS_IP to your server address}"
VPS_USER="${VPS_USER:-root}"
VPS_DOMAIN="${VPS_DOMAIN:-}"
SSH=(ssh -o StrictHostKeyChecking=accept-new "${VPS_USER}@${VPS_IP}")

if [[ ! -f "${DB}" ]]; then
  echo "Missing local DB: ${DB}"
  exit 1
fi

echo "==> Uploading bootstrap script"
"${SSH[@]}" "mkdir -p /tmp/oca-deploy"
scp -o StrictHostKeyChecking=accept-new \
  "${WEB}/deploy/bootstrap-vps.sh" \
  "${VPS_USER}@${VPS_IP}:/tmp/oca-deploy/bootstrap-vps.sh"

echo "==> Running bootstrap on VPS (Node, clone, build, systemd, nginx, cron)"
"${SSH[@]}" "bash /tmp/oca-deploy/bootstrap-vps.sh ${VPS_DOMAIN}"

echo "==> rsync option_chain.db (~8.3 GB — this takes a while)"
"${SSH[@]}" "mkdir -p /opt/oca/web/data && chown -R oca:oca /opt/oca/web/data || true"
rsync -avP --progress \
  "${DB}" \
  "${VPS_USER}@${VPS_IP}:/opt/oca/web/data/option_chain.db"

echo "==> Fix ownership + refresh stats + restart"
"${SSH[@]}" "chown oca:oca /opt/oca/web/data/option_chain.db
  ln -sfn /opt/oca/web/data/option_chain.db /opt/oca/web/.next/standalone/data/option_chain.db
  sudo -u oca bash -lc 'cd /opt/oca/web && LIBSQL_URL=file:/opt/oca/web/data/option_chain.db npx tsx --env-file=.env.production scripts/push-archive-stats.ts'
  systemctl restart oca
  systemctl --no-pager --full status oca | head -20"

echo ""
echo "Done. Open http://${VPS_IP}/ (or https://${VPS_DOMAIN} after DNS)."
echo "Then: point DNS A → ${VPS_IP}; pause Vercel + Turso in their dashboards."
