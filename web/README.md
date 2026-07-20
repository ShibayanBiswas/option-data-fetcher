# Option Chain Archive

Historical NSE / BSE option-chain desk — browse, download, and auto-sync.

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
   - `CRON_SECRET`, `SYNC_SECRET` (generate with `openssl rand -hex 32`)
4. **Deploy** → wait for build
5. **Seed** from laptop with same Turso creds:
   ```bash
   npm run seed:backfill   # full UDiFF history for ALL securities (NSE+BSE)
   ```
6. **Verify** — Browse, CSV Zip, Sync Today, cron job in Vercel settings

> **Coverage:** NSE/BSE UDiFF F&O bhavcopy begins **2024-01-01**. Pre-2024 files use a different layout and are not ingested. Latest session appears after ~18:30 IST settlement. BSE stock options (`STO`) appear in bhavcopy from **~2024-06-27** onward; earlier BSE sessions are index-only.

## What you get

- Left **file tree** (Index/Stock open by default; trade dates in main panel only)
- Right panel scrolls **independently** from sidebar
- **Compact folder tiles** — Index Options, Stock Options, symbols (title + status, no wasted space)
- Trade dates & expiry files as **clean scroll lists**
- Schema **compact cards** for UDiFF columns + stock sectors with larger **NSE | BSE** buttons
- Horizontal **Scroll →** rails on Home + Schema
- Streaming **CSV Zip** downloads (safe for full INDEX CALL history)
- ⌘K search · Sync Today · weekday cron

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
| Tree / browse APIs | Short private cache + distinct-value cache |
| Sidebar | Does not load hundreds of trade dates |
| CSV Zip | Server streams via archiver; browser native download |
| Excel Zip | Max 250 files per zip — use CSV for larger folders |
| Leaf download | Single file + cache headers |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local UI |
| `npm run seed N` | Last N sessions |
| `npm run seed:all` | Full calendar from 2024-01-01 (skip existing) |
| `npm run seed:backfill` | **Fill gaps** — all securities NSE+BSE to latest |
| `npm run seed:max` | Wipe → full INDEX + recent STOCK only |
| `npm run seed:fresh` | Wipe + full re-download all segments |
| `npm run typecheck` | TypeScript check |

## Manual sync

- UI: **Sync Today**
- API: `POST /api/sync`
- Cron: `GET /api/cron/daily-sync` with `Authorization: Bearer $CRON_SECRET`
