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

- **Browse** — left file tree + right panel (separate scrolling)
- **Schema** — full-width maps + card rails (fill or horizontal scroll)
- **Home** — coverage KPIs, desk navigation map, capabilities, pipeline
- **⌘K / Ctrl+K** — jump search
- **Sync Today** — pull the latest bhavcopy session

## Docs

| Doc | Audience |
|-----|----------|
| [`web/DEPLOY.md`](web/DEPLOY.md) | **Full deploy guide** — GitHub → Turso → Vercel → cron → download tips |
| [`web/README.md`](web/README.md) | App features, hierarchy, scripts |

## Deploy (summary)

Deploy the **`web`** folder to Vercel with **Turso**:

- `LIBSQL_URL`
- `LIBSQL_AUTH_TOKEN`
- `CRON_SECRET`
- `SYNC_SECRET`

Weekday cron (`web/vercel.json`) calls `/api/cron/daily-sync` at **11:30 UTC** (~17:00 IST).

Seed Turso once from your laptop (`npm run seed:max` or `seed:fresh` with Turso env set).

Full checklist: **[`web/DEPLOY.md`](web/DEPLOY.md)**.

## Hierarchy

```
NSE | BSE
 └── Index Options | Stock Options | Other Securities
      └── Symbol (stocks under sector folders)
           └── CALL | PUT
                └── Trade date (oldest → newest; calendar filter)
                     └── expiry_date_YYYY-MM-DD
```
