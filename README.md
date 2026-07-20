# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download, sync.

## Quick start

```bash
cd web
npm install
npm run seed 10        # or: npm run seed:fresh  (full wipe + history, long)
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
4. Deploy → seed Turso once from laptop (`npm run seed:max`)
5. Verify Browse, downloads, Sync Today, cron

Weekday cron: **11:30 UTC** (~17:00 IST) → `/api/cron/daily-sync`

Full guide: **[`web/DEPLOY.md`](web/DEPLOY.md)**

## Hierarchy

```
NSE | BSE
 └── Index Options | Stock Options | Other Securities
      └── Symbol (stocks under sector folders)
           └── CALL | PUT
                └── Trade date (oldest → newest; calendar filter)
                     └── expiry_date_YYYY-MM-DD
```
