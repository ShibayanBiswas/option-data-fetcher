# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, CSV download, daily bhavcopy sync.

**Production:** this PC + **local SQLite** (`data/option_chain.db`) + **Cloudflare Tunnel**.

## Quick start

```bash
cd web
npm install
cp .env.example .env.local
npm run seed:backfill   # or: npm run seed 10
npm run dev
```

## Deploy (Cloudflare Tunnel)

```bash
cd web
bash deploy/install-local-tunnel.sh
journalctl --user -u cloudflared-oca -n 40 --no-pager | grep trycloudflare
```

Guide: [`web/DEPLOY.md`](web/DEPLOY.md) · [`web/DEPLOY-LOCAL-TUNNEL.md`](web/DEPLOY-LOCAL-TUNNEL.md)

Daily sync: weekday cron `seed-backfill` + Sync Today → updates the **same local DB**.

## Hierarchy

```
NSE | BSE
 └── Index Options | Stock Options | Other Securities
      └── Symbol
           └── CALL | PUT
                └── Trade date
                     └── expiry_date_YYYY-MM-DD
```
