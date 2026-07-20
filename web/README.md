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
2. Create a Turso database
3. Set `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`, `CRON_SECRET`, `SYNC_SECRET`
4. Seed Turso once (`npm run seed:max` or `seed:fresh` with Turso env set)
5. Weekday cron at 11:30 UTC hits `/api/cron/daily-sync`

## What you get

- Left **file tree** (Index Options + Stock Options open by default; daily folders stay closed until you open them)
- Right panel scrolls **on its own** (independent from the sidebar)
- Trade-date lists: **newest → oldest**, with a **calendar range** filter (full range by default)
- One CSV / Excel download control per page (no duplicates on strike tables)
- Horizontal scroll card rails on Home + Schema
- Interactive exchange flowchart with working links and tree lines
- ⌘K / Ctrl+K search
- Sync Today + weekday auto-refresh

## Hierarchy

```
NSE | BSE
 └── INDEX | STOCK | OTHER
      └── Symbol (STOCK grouped by sector)
           └── CALL | PUT
                └── Trade date
                     └── expiry_date_YYYY-MM-DD
```

Segregation: UDiFF `FinInstrmTp` **IDO → INDEX**, **STO → STOCK**, else **OTHER**.

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
