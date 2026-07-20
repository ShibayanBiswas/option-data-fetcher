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
- **Schema** — horizontal card rails + exchange flowchart
- **⌘K / Ctrl+K** — jump search
- **Sync Today** — pull the latest bhavcopy session

## Docs

| Doc | Audience |
|-----|----------|
| [`web/DEPLOY.md`](web/DEPLOY.md) | **Layman deploy guide** — GitHub → Turso → Vercel → daily cron |
| [`web/README.md`](web/README.md) | App features + scripts |

## Deploy (summary)

Deploy the **`web`** folder to Vercel with **Turso**:

- `LIBSQL_URL`
- `LIBSQL_AUTH_TOKEN`
- `CRON_SECRET`
- `SYNC_SECRET`

Weekday cron (`web/vercel.json`) calls `/api/cron/daily-sync` at **11:30 UTC** (~17:00 IST).

Full checklist with screenshots-level steps: **[`web/DEPLOY.md`](web/DEPLOY.md)**.
