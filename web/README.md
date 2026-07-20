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

## Deploy to the internet (Vercel + Turso)

**Complete beginner guide:** [`DEPLOY.md`](./DEPLOY.md)

Short version:

1. Root Directory on Vercel = **`web`**
2. Create a Turso database (prefer a region near your users)
3. Set `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`, `CRON_SECRET`, `SYNC_SECRET`
4. Seed Turso once (`npm run seed:max` or `seed:fresh` with Turso env set)
5. Weekday cron at 11:30 UTC hits `/api/cron/daily-sync`
6. Smoke-test Browse + CSV/Excel downloads after deploy

## What you get

- Left **file tree** (Index Options + Stock Options open by default; CALL/PUT are leaves — trade dates load in the main panel only)
- Right panel scrolls **on its own** (independent from the sidebar)
- Trade-date lists: **oldest → newest**, with a **calendar range** filter
- Home: horizontal **capabilities** + **pipeline** card rails (Scroll →), desk navigation map, coverage KPIs
- Schema: horizontal card rails for hierarchy / segregation / pipeline / columns / sectors
- Browse root: **NSE | BSE exchange picker** (no full-archive zip — pick a folder first)
- Schema: full-width **exchange map**, NSE|BSE pair links on sectors & segregation
- Motion: page transitions, sidebar expand, download success flash (respects reduced-motion)
- ⌘K / Ctrl+K search
- Sync Today + weekday auto-refresh

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

## Performance notes

| Area | Behaviour |
|------|-----------|
| Tree / browse APIs | Short private cache + distinct-value cache |
| Sidebar | Does not load hundreds of trade dates |
| Folder zip download | Native browser stream (not buffered in JS) |
| Excel zip | Parallel workbook build; prefer CSV Zip for large folders |
| Leaf download | Single file + 1h cache headers |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local UI |
| `npm run seed N` | Last N sessions → SQLite + CSV |
| `npm run seed:all` | All calendar sessions |
| `npm run seed:fresh` | Wipe DB + store, full re-download |
| `npm run seed:max` | Full INDEX + last N STOCK days |
| `npm run ingest:local` | CSV store → SQLite |
| `npm run typecheck` | TypeScript check |

## Manual sync

- UI: **Sync Today**
- API: `POST /api/sync`
- Cron: `GET /api/cron/daily-sync` with `Authorization: Bearer $CRON_SECRET`
