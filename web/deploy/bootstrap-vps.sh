#!/usr/bin/env bash
# Run ON the Ubuntu 24.04 VPS as root.
# Usage: bash bootstrap-vps.sh [domain]
set -euo pipefail

DOMAIN="${1:-}"
REPO_URL="${REPO_URL:-https://github.com/ShibayanBiswas/option-data-fetcher.git}"
APP_ROOT="/opt/oca"
WEB_ROOT="${APP_ROOT}/web"
NODE_MAJOR=22

echo "==> Option Chain Archive VPS bootstrap"
echo "    domain=${DOMAIN:-'(none — HTTP only for now)'}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl build-essential nginx rsync ca-certificates

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | cut -d. -f1 | tr -d v)" != "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

if ! id oca >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash oca
fi

mkdir -p "${WEB_ROOT}/data"
if [[ ! -d "${APP_ROOT}/.git" ]]; then
  git clone "${REPO_URL}" "${APP_ROOT}"
else
  git -C "${APP_ROOT}" fetch --all --prune
  git -C "${APP_ROOT}" checkout main
  git -C "${APP_ROOT}" pull --ff-only origin main
fi
chown -R oca:oca "${APP_ROOT}"

ENV_FILE="${WEB_ROOT}/.env.production"
if [[ ! -f "${ENV_FILE}" ]]; then
  CRON_SECRET="$(openssl rand -hex 32)"
  SYNC_SECRET="$(openssl rand -hex 32)"
  cat > "${ENV_FILE}" <<EOF
LIBSQL_URL=file:./data/option_chain.db
CRON_SECRET=${CRON_SECRET}
SYNC_SECRET=${SYNC_SECRET}
EOF
  echo "==> Wrote ${ENV_FILE} (secrets generated)"
else
  echo "==> Keeping existing ${ENV_FILE}"
fi
chown oca:oca "${ENV_FILE}"
chmod 600 "${ENV_FILE}"

echo "==> npm ci + build (as oca)"
sudo -u oca bash -lc "cd '${WEB_ROOT}' && npm ci && npm run build"
sudo -u oca bash -lc "
  cd '${WEB_ROOT}'
  mkdir -p .next/standalone/.next .next/standalone/data
  cp -a public .next/standalone/
  cp -a .next/static .next/standalone/.next/
  ln -sfn '${WEB_ROOT}/data/option_chain.db' .next/standalone/data/option_chain.db
"

if [[ ! -f "${WEB_ROOT}/data/option_chain.db" ]]; then
  echo "!! WARNING: ${WEB_ROOT}/data/option_chain.db missing."
  echo "   From your laptop run:"
  echo "   rsync -avP --progress web/data/option_chain.db root@VPS_IP:${WEB_ROOT}/data/option_chain.db"
fi
chown -R oca:oca "${WEB_ROOT}/data" || true

cp "${WEB_ROOT}/deploy/oca.service" /etc/systemd/system/oca.service
systemctl daemon-reload
systemctl enable oca
systemctl restart oca
sleep 2
systemctl --no-pager --full status oca || true

NGINX_SITE=/etc/nginx/sites-available/oca
if [[ -n "${DOMAIN}" ]]; then
  sed "s/YOUR_DOMAIN/${DOMAIN}/g" "${WEB_ROOT}/deploy/nginx-oca.conf" > "${NGINX_SITE}"
else
  sed "s/YOUR_DOMAIN/_/g" "${WEB_ROOT}/deploy/nginx-oca.conf" > "${NGINX_SITE}"
fi
ln -sfn "${NGINX_SITE}" /etc/nginx/sites-enabled/oca
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ -n "${DOMAIN}" ]]; then
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email || \
    echo "!! certbot failed (DNS may not point here yet). Re-run: certbot --nginx -d ${DOMAIN}"
fi

# Weekday daily sync ~19:30 IST = 14:00 UTC
CRON_LINE="0 14 * * 1-5 cd ${WEB_ROOT} && /usr/bin/npx tsx --env-file=.env.production scripts/seed-backfill.ts >> ${WEB_ROOT}/data/sync.log 2>&1"
sudo -u oca bash -lc "(crontab -l 2>/dev/null | grep -v seed-backfill || true; echo '${CRON_LINE}') | crontab -"
echo "==> Cron installed for user oca:"
sudo -u oca crontab -l

if [[ -f "${WEB_ROOT}/data/option_chain.db" ]]; then
  echo "==> Refreshing archive_stats"
  sudo -u oca bash -lc "cd '${WEB_ROOT}' && LIBSQL_URL=file:${WEB_ROOT}/data/option_chain.db npx tsx --env-file=.env.production scripts/push-archive-stats.ts" || true
fi

IP="$(curl -4 -fsS ifconfig.me || hostname -I | awk '{print $1}')"
echo ""
echo "============================================"
echo " Bootstrap complete"
echo " App:     http://${IP}:3000  (direct)"
echo " Nginx:   http://${DOMAIN:-$IP}/"
echo " Service: systemctl status oca"
echo " DB path: ${WEB_ROOT}/data/option_chain.db"
echo "============================================"
echo " Next on laptop:"
echo "  1) rsync DB if not present"
echo "  2) Point DNS A record ${DOMAIN:-your.domain} → ${IP}"
echo "  3) Pause Vercel project + Turso DB"
echo "============================================"
