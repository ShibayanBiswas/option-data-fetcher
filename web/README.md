# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download CSV, and auto-sync to Turso.

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
6. **Verify** — Browse, CSV Zip, Sync Today, cron job (`0 14 * * 1-5` ≈ 19:30 IST)

> **Coverage:** NSE/BSE UDiFF F&O bhavcopy begins **2024-01-01**. Pre-2024 files use a different layout and are not ingested. Latest session appears after ~18:30 IST settlement. BSE stock options (`STO`) appear in bhavcopy from **~2024-06-27** onward; earlier BSE sessions are index-only.

## What you get

- Left **file tree** (Index/Stock open by default; trade dates in main panel only) — cached + parallel prefetch for fast expand
- Right panel scrolls **independently** from sidebar
- **Compact folder tiles** — Index Options, Stock Options, symbols (title + status)
- Trade dates & expiry files as **clean scroll lists**
- Schema cards for UDiFF columns + stock sectors with **NSE | BSE** buttons
- Horizontal **Scroll →** rails on Home + Schema
- **CSV only** — leaf CSV or streaming **CSV Zip** (Excel removed)
- ⌘K search · Sync Today · weekday cron → **Turso**

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
| Tree / browse APIs | Private cache 5 min + SWR 10 min |
| Sidebar | Prefetches exchange/segment nodes; no trade-date flood |
| CSV Zip | Server streams via archiver; browser native download |
| Leaf download | Single CSV + cache headers |
| Daily sync | Cron + Sync Today write to Turso via `LIBSQL_*` |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local UI |
| `npm run seed N` | Last N sessions |
| `npm run seed:all` | Full calendar from 2024-01-01 (skip existing) |
| `npm run seed:backfill` | **Fill gaps** — all securities NSE+BSE to latest |
| `npm run seed:turso:fast` | Wipe Turso + parallel copy from local SQLite |
| `npm run check:turso` | Count docs / span on remote Turso |
| `npm run seed:max` | Wipe → full INDEX + recent STOCK only |
| `npm run seed:fresh` | Wipe + full re-download all segments |
| `npm run typecheck` | TypeScript check |

## Manual sync

- UI: **Sync Today** (same-origin; writes to configured DB — Turso in prod)
- API: `POST /api/sync`
- Cron: `GET /api/cron/daily-sync` with `Authorization: Bearer $CRON_SECRET`
