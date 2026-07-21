# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download CSV, sync to Turso.

**Status:** production-ready. Vercel (`web/` root) + Turso + weekday cron. CSV-only downloads, live End Date / calendars, light & dark desk UI.

## Quick start

```bash
cd web
npm install
npm run seed:backfill   # full UDiFF history (2024-01-01 → latest) for all securities
# or: npm run seed 10   # quick smoke test
npm run dev
```

Open http://localhost:3000

- **Browse** — file tree + panel; NSE | BSE picker; compact folder tiles
- **Schema** — horizontal card rails; exchange map
- **Home** — live KPI coverage rail (horizontal scroll), navigation map, pipeline rows
- **⌘K / Ctrl+K** — jump search
- **Theme** — light / dark (persisted; no flash on reload)
- **Downloads** — CSV only (leaf CSV or streaming CSV Zip)
- **Sync** — Sync Today · quiet IST-day catch-up · weekday cron → Turso

## Docs

| Doc | Audience |
|-----|----------|
| [`web/DEPLOY.md`](web/DEPLOY.md) | **Full Vercel deploy** — Turso, env vars, seed, cron, checklist |
| [`web/README.md`](web/README.md) | Features, hierarchy, scripts, live sync behaviour |

## Deploy on Vercel (summary)

1. Import repo — **Root Directory = `web`**
2. Turso DB → `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`
3. `CRON_SECRET`, `SYNC_SECRET` (Production + Preview)
4. Deploy → seed once (`npm run seed:turso:fast` or `seed:backfill`)
5. Verify Browse, CSV Zip, Sync Today, dark mode, cron

Weekday cron: **14:00 UTC (~19:30 IST)** → `/api/cron/daily-sync` (writes Turso).

**History:** UDiFF F&O from **2024-01-01**. Use `seed:backfill` / `seed:turso:fast` for full INDEX + STOCK + OTHER coverage.

## Hierarchy

```
NSE | BSE
 └── Index Options | Stock Options | Other Securities
      └── Symbol (stocks under sector folders)
           └── CALL | PUT
                └── Trade date (oldest → newest; calendar filter)
                     └── expiry_date_YYYY-MM-DD
```
