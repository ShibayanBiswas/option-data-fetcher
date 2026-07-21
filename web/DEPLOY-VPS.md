# Deploy Option Chain Archive on a VPS (recommended)

**Why not Vercel alone?** The archive SQLite file is **~8.3 GB**. Vercel has no durable disk for that. Turso free-tier rows-read also cannot sustain full-table KPI scans. Production should be a **VPS + on-disk SQLite**.

Use this guide for redeploy. Keep [`DEPLOY.md`](./DEPLOY.md) only if you insist on Vercel + paid Turso.

---

## Pinned versions

| Piece | Version |
|--------|---------|
| OS | **Ubuntu 24.04 LTS** |
| Node.js | **22.14.0** (Node 22 LTS) |
| npm | comes with Node 22 |
| Next.js | **15.5.x** (from `package.json`) |
| Docker base (optional) | `node:22.14.0-bookworm-slim` |
| Nginx | Ubuntu distro package (1.24+) |
| Certbot | Ubuntu distro package |
| Disk | **≥ 40 GB** SSD (DB ~8–10 GB + headroom) |
| RAM | **≥ 4 GB** recommended |

---

## Architecture

```
Laptop (option_chain.db)
        │  rsync once
        ▼
VPS /opt/oca/web/data/option_chain.db   ← daily seed-backfill appends here
        │
   Next.js (port 3000)  ←── Nginx :443 (optional HTTPS)
```

Env: `LIBSQL_URL=file:/opt/oca/web/data/option_chain.db` — **no Turso**.

---

## Path A — Bare metal (systemd) — simplest

### 1. Create VPS
Hetzner CX22 / DigitalOcean 4 GB · Ubuntu 24.04 · open ports **22, 80, 443**.

### 2. Install Node 22.14
```bash
apt update && apt install -y git curl build-essential nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # expect v22.x
```

### 3. App user + clone
```bash
useradd --system --create-home --shell /bin/bash oca
mkdir -p /opt/oca
git clone https://github.com/ShibayanBiswas/option-data-fetcher.git /opt/oca
chown -R oca:oca /opt/oca
```

### 4. Upload DB from your laptop (one time)
```bash
# on laptop
mkdir -p keeps-server-ready
rsync -avP --progress \
  "/home/shibayanbiswas/Desktop/Option Data Fetcher/web/data/option_chain.db" \
  root@YOUR_VPS_IP:/opt/oca/web/data/option_chain.db
```

On server:
```bash
mkdir -p /opt/oca/web/data
chown -R oca:oca /opt/oca/web/data
```

### 5. Env file
```bash
sudo -u oca cp /opt/oca/web/.env.production.example /opt/oca/web/.env.production
sudo -u oca nano /opt/oca/web/.env.production
```

Set:
```env
LIBSQL_URL=file:/opt/oca/web/data/option_chain.db
CRON_SECRET=<openssl rand -hex 32>
SYNC_SECRET=<different openssl rand -hex 32>
```

### 6. Build
```bash
cd /opt/oca/web
sudo -u oca npm ci
sudo -u oca npm run build
# standalone layout
sudo -u oca bash -c 'cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/'
mkdir -p /opt/oca/web/.next/standalone/data
# point standalone cwd data → real DB
ln -sfn /opt/oca/web/data/option_chain.db /opt/oca/web/.next/standalone/data/option_chain.db
chown -R oca:oca /opt/oca/web
```

Update `.env.production` for the service working directory:
```env
LIBSQL_URL=file:./data/option_chain.db
```
(systemd `WorkingDirectory` = standalone folder)

### 7. systemd
```bash
cp /opt/oca/web/deploy/oca.service /etc/systemd/system/oca.service
# Ensure WorkingDirectory=/opt/oca/web/.next/standalone
systemctl daemon-reload
systemctl enable --now oca
systemctl status oca
```

### 8. KPI cache
```bash
cd /opt/oca/web
sudo -u oca env LIBSQL_URL=file:/opt/oca/web/data/option_chain.db \
  npx tsx --env-file=.env.production scripts/push-archive-stats.ts
```

### 9. Nginx + HTTPS
```bash
cp /opt/oca/web/deploy/nginx-oca.conf /etc/nginx/sites-available/oca
# edit YOUR_DOMAIN
ln -sf /etc/nginx/sites-available/oca /etc/nginx/sites-enabled/oca
nginx -t && systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN
```

### 10. Daily sync (weekdays ~19:30 IST = 14:00 UTC)
```bash
crontab -e -u oca
```
```cron
0 14 * * 1-5 cd /opt/oca/web && /usr/bin/npx tsx --env-file=.env.production scripts/seed-backfill.ts >> /opt/oca/web/data/sync.log 2>&1
```

### 11. Redeploy code later
```bash
cd /opt/oca && sudo -u oca git pull
cd web && sudo -u oca npm ci && sudo -u oca npm run build
sudo -u oca bash -c 'cp -r public .next/standalone/ && mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/'
ln -sfn /opt/oca/web/data/option_chain.db /opt/oca/web/.next/standalone/data/option_chain.db
systemctl restart oca
```

**Never delete** `/opt/oca/web/data/option_chain.db` on redeploy.

---

## Path B — Docker Compose

```bash
cd /opt/oca/web
cp .env.production.example .env.production
# edit secrets; keep LIBSQL_URL=file:/app/data/option_chain.db

# DB must already be at ./data/option_chain.db on the host
docker compose up -d --build
```

Daily sync (host cron calling the app container tools is heavier). Prefer **Path A** for cron simplicity, or:

```bash
# on host, with Node 22 installed alongside Docker:
0 14 * * 1-5 cd /opt/oca/web && LIBSQL_URL=file:./data/option_chain.db npx tsx --env-file=.env.production scripts/seed-backfill.ts >> ./data/sync.log 2>&1
```

---

## About Vercel

| Goal | Do this |
|------|---------|
| Host the **8 GB DB** on Vercel | **Not possible** |
| Keep using Vercel for the UI | Only with an external DB (paid Turso or a remote API on this VPS) — extra work |
| Recommended | **Point your domain to the VPS**; pause/delete the Vercel project |

To retire Vercel + Turso:
1. Deploy VPS as above.
2. Point DNS A record → VPS IP.
3. In Vercel: remove `LIBSQL_*` or delete the project.
4. Pause/delete the Turso database.

---

## Verify

- https://YOUR_DOMAIN → home KPIs (Start/End dates, ~819k files)
- Browse NSE → Index → NIFTY → CALL → dates
- Sync Today appends latest bhavcopy into the same file
- `ls -lh /opt/oca/web/data/option_chain.db` grows slowly over time (not full re-upload)

---

## Checklist

- [ ] Ubuntu 24.04 + Node 22.14
- [ ] `option_chain.db` rsynced once
- [ ] `.env.production` uses `file:…` (no `libsql://`)
- [ ] `oca` service running on :3000
- [ ] Nginx + HTTPS
- [ ] Weekday cron `seed-backfill`
- [ ] DNS away from Vercel
- [ ] Turso / old Vercel env cleaned up
