# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download CSV, daily sync to **local SQLite**.

## Quick start (laptop)

```bash
cd web
npm install
cp .env.example .env.local
npm run seed 10
npm run dev
```

`SQLITE_URL=file:./data/option_chain.db` (default).

## Deploy

**Cloudflare Tunnel + local DB** — [`DEPLOY.md`](./DEPLOY.md) / [`DEPLOY-LOCAL-TUNNEL.md`](./DEPLOY-LOCAL-TUNNEL.md)

```bash
bash deploy/install-local-tunnel.sh
```

## What you get

- File tree browse · CSV Zip · dark mode · ⌘K search
- Sync Today + weekday `seed-backfill` into `data/option_chain.db`
- Live End Date / KPI band from local `archive_stats`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local UI |
| `npm run seed:backfill` | Fill gaps from bhavcopy |
| `npm run push:stats` | Refresh KPI cache row |
| `npm run audit:archive` | Integrity audit |
| `npm run typecheck` | TypeScript check |
