# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download CSV, daily sync.

**Recommended production:** **VPS + on-disk SQLite** (~8.3 GB file). Vercel cannot host that database; Turso free-tier is a poor fit for this size.

## Quick start (laptop)

```bash
cd web
npm install
npm run seed:backfill   # full UDiFF history (2024-01-01 → latest)
npm run dev
```

Open http://localhost:3000

## Docs

| Doc | Use when |
|-----|----------|
| [`web/DEPLOY-VPS.md`](web/DEPLOY-VPS.md) | **Production redeploy (recommended)** — Ubuntu 24.04, Node 22, SQLite file, cron |
| [`web/DEPLOY.md`](web/DEPLOY.md) | Legacy Vercel + Turso only (needs paid Turso; not for 8 GB free-tier) |
| [`web/README.md`](web/README.md) | Features, hierarchy, scripts |

## Production (summary)

1. Create Ubuntu **24.04** VPS (4 GB RAM, **40 GB+** disk)
2. Install **Node 22.14**
3. `rsync` your local `web/data/option_chain.db` once
4. Set `LIBSQL_URL=file:…` (no Turso)
5. `npm run build` + systemd (or Docker Compose)
6. Weekday cron: `seed-backfill` at **14:00 UTC**
7. Point DNS at the VPS; pause Vercel / Turso

Pinned versions and full steps: **[`web/DEPLOY-VPS.md`](web/DEPLOY-VPS.md)**.

## Hierarchy

```
NSE | BSE
 └── Index Options | Stock Options | Other Securities
      └── Symbol (stocks under sector folders)
           └── CALL | PUT
                └── Trade date (oldest → newest; calendar filter)
                     └── expiry_date_YYYY-MM-DD
```
