# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download CSV, daily sync.

## Quick start (laptop)

```bash
cd web
npm install
cp .env.example .env.local
npm run seed 10          # or: npm run seed:backfill  (full history)
npm run dev              # http://localhost:3000
```

Leave `LIBSQL_*` empty in `.env.local` to use local SQLite at `data/option_chain.db`.

## Deploy (production)

**Recommended:** VPS + on-disk SQLite — **[`DEPLOY-VPS.md`](./DEPLOY-VPS.md)**  
(Ubuntu 24.04 · Node 22.14 · ~8 GB `option_chain.db` · weekday cron)

**Legacy only:** Vercel + paid Turso — [`DEPLOY.md`](./DEPLOY.md)

### Vercel note

Vercel **cannot** store the 8.3 GB SQLite file. Do not redeploy the full archive onto Vercel alone. Use the VPS guide, then point your domain at the VPS.

## What you get

- Left **file tree** (Index/Stock open by default; trade dates in main panel only)
- Compact folder tiles + trade-date / expiry lists
- Glass **water-sheen** buttons and cards
- Full **dark mode**
- **CSV only** — leaf CSV or streaming CSV Zip
- ⌘K search · Sync Today · weekday cron
- Live End Date / KPI coverage band

## Hierarchy

```
NSE | BSE
 └── INDEX | STOCK | OTHER
      └── Symbol (STOCK grouped by sector)
           └── CALL | PUT
                └── Trade date (oldest → newest)
                     └── expiry_date_YYYY-MM-DD
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local UI |
| `npm run seed:backfill` | Fill gaps from bhavcopy → latest |
| `npm run push:stats` | Refresh one-row KPI cache |
| `npm run compare:dbs` | Local vs Turso (if still using Turso) |
| `npm run typecheck` | TypeScript check |
