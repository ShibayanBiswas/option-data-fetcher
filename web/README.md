# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download CSV, daily sync.

## Quick start (laptop)

```bash
cd web
npm install
cp .env.example .env.local
# Keep SQLITE_URL=file:./data/option_chain.db for local desk
npm run seed:backfill   # or npm run seed 10 for a smoke test
npm run dev
```

## Deploy (Vercel + Turso)

Full guide: **[`DEPLOY.md`](./DEPLOY.md)** · Vercel env checklist: **[`VERCEL-ENV.md`](./VERCEL-ENV.md)**

1. Turso DB loaded from local file (2025-01-01 → latest)  
2. Put env vars from `.env.local` into Vercel (Root Directory = `web`)  
3. Deploy — weekday cron `/api/cron/daily-sync` keeps Turso updated  

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local UI |
| `npm run seed:backfill` | Fill gaps from bhavcopy |
| `npm run seed:turso:fast` | Copy local DB → Turso |
| `npm run push:stats` | Refresh KPI cache (local compute → 1 Turso write) |
| `npm run check:turso` | Coverage check |
| `npm run audit:archive` | Integrity audit |
| `npm run typecheck` | TypeScript check |
