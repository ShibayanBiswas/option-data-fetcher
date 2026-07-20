# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download, sync.

## Quick start

```bash
cd web
npm install
npm run seed:backfill   # full UDiFF history (2024-01-01 → latest) for all securities
# or: npm run seed 10   # quick smoke test
npm run dev
```

Open http://localhost:3000

- **Browse** — file tree + panel; NSE | BSE picker at root; compact folder tiles
- **Schema** — horizontal card rails (compact columns/sectors); exchange map
- **Home** — KPI coverage, navigation map, capability/pipeline scroll rows
- **⌘K / Ctrl+K** — jump search
- **Sync Today** — latest bhavcopy session

## Docs

| Doc | Audience |
|-----|----------|
| [`web/DEPLOY.md`](web/DEPLOY.md) | **Full Vercel deploy from scratch** — Turso, env vars, seed, cron, checklist |
| [`web/README.md`](web/README.md) | App features, hierarchy, scripts |

## Deploy on Vercel (summary)

1. Import repo on Vercel — **Root Directory = `web`**
2. Create Turso DB → set `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`
3. Set `CRON_SECRET`, `SYNC_SECRET` (Production)
4. Deploy → seed Turso once from laptop (`npm run seed:backfill`)
5. Verify Browse, downloads, Sync Today, cron

**Full history:** UDiFF F&O bhavcopy starts **2024-01-01** on NSE and BSE. Use `seed:backfill` (or `seed:fresh`) so INDEX + STOCK + OTHER cover every published session through the latest settle.

## Hierarchy

```
NSE | BSE
 └── Index Options | Stock Options | Other Securities
      └── Symbol (stocks under sector folders)
           └── CALL | PUT
                └── Trade date (oldest → newest; calendar filter)
                     └── expiry_date_YYYY-MM-DD
```
