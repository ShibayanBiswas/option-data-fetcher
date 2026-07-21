# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download CSV, and auto-sync to Turso.

**Wind-up:** App is feature-complete for desk use — CSV exports, Turso-backed live dates, glass water UI, polished light **and** dark mode, quiet daily catch-up + weekday cron.

## Quick start (laptop)

```bash
cd web
npm install
cp .env.example .env.local
npm run seed 10          # or: npm run seed:fresh  (full history, long)
npm run dev              # http://localhost:3000
```

Leave `LIBSQL_*` empty in `.env.local` to use local SQLite at `data/option_chain.db`.

## Deploy on Vercel (from scratch)

**Complete guide:** [`DEPLOY.md`](./DEPLOY.md)

### Short checklist

1. **Vercel** → Import `option-data-fetcher` → Root Directory **`web`**
2. **Turso** → Create DB → copy URL + token
3. **Env vars** (Production):
   - `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`
   - `CRON_SECRET`, `SYNC_SECRET` (Production + Preview; `openssl rand -hex 32`)
4. **Deploy** → wait for build
5. **Seed** from laptop with same Turso creds:
   ```bash
   npm run seed:turso:fast   # preferred: parallel copy from local SQLite
   # or: npm run seed:backfill   # re-download missing days from bhavcopy
   ```
6. **Verify** — Browse, CSV Zip, Sync Today, **dark mode toggle**, cron (`0 14 * * 1-5` ≈ 19:30 IST)

> **Coverage:** NSE/BSE UDiFF F&O bhavcopy begins **2024-01-01**. Pre-2024 files use a different layout and are not ingested. Latest session appears after ~18:30 IST settlement. BSE stock options (`STO`) appear in bhavcopy from **~2024-06-27** onward; earlier BSE sessions are index-only.

## What you get

- Left **file tree** (Index/Stock open by default; trade dates in main panel only)
- Independent sidebar / main scroll with stable scrollbars
- Compact folder tiles + clean trade-date / expiry lists
- Glass **water-sheen** buttons and cards (hover only — no flicker loops)
- Full **dark mode** (token surfaces, date pickers, maps, dialogs)
- Schema rails + exchange map with NSE | BSE jumps
- **CSV only** — leaf CSV or streaming CSV Zip
- ⌘K search · Sync Today · quiet IST-day catch-up · weekday cron → **Turso**
- Live End Date in header; KPI coverage band scrolls horizontally (IBM Plex Mono figures); calendars soft-refresh after sync

## Hierarchy

```
NSE | BSE
 └── INDEX | STOCK | OTHER
      └── Symbol (STOCK grouped by sector)
           └── CALL | PUT
                └── Trade date (oldest → newest)
                     └── expiry_date_YYYY-MM-DD
```

Segregation: UDiFF `FinInstrmTp` **IDO → INDEX**, **STO → STOCK**, else **OTHER**.

## Performance & downloads

| Area | Behaviour |
|------|-----------|
| Tree / browse APIs | Short private cache + SWR |
| Sidebar | Prefetches exchange/segment; no trade-date flood |
| CSV Zip | Streaming archiver; browser native download |
| Leaf download | Single CSV |
| Daily sync | Cron (~19:30 IST) + Sync Today + quiet catch-up → Turso |
| Live dates | Status fingerprinting; calendars extend when End Date advances |
| Theme | `localStorage` + pre-paint script; light & dark |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local UI |
| `npm run seed N` | Last N sessions |
| `npm run seed:all` | Full calendar from 2024-01-01 (skip existing) |
| `npm run seed:backfill` | Fill gaps — all securities NSE+BSE to latest |
| `npm run seed:turso:fast` | Wipe Turso + parallel copy from local SQLite |
| `npm run check:turso` | Count docs / span on remote Turso |
| `npm run seed:max` | Wipe → full INDEX + recent STOCK only |
| `npm run seed:fresh` | Wipe + full re-download all segments |
| `npm run typecheck` | TypeScript check |

## Manual sync

- UI: **Sync Today** (same-origin; writes to Turso in prod)
- API: `POST /api/sync`
- Cron: `GET /api/cron/daily-sync` with `Authorization: Bearer $CRON_SECRET`
