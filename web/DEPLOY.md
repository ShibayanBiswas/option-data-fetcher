# Deploy: Vercel + Turso

Next.js UI on **Vercel**. Archive data on **Turso** (`libsql://…`).  
Local `data/option_chain.db` (~8.3 GB) cannot live on Vercel disk.

> **Important:** Full history (~819k docs) will exhaust **Turso free-tier rows-read**.  
> Use a **paid Turso plan** (or expect quota / rate-limit errors). The app is hardened to avoid full-table scans on page load, but browsing still reads rows.

---

## 1) Create Turso DB (new account)

1. Sign up at https://turso.tech  
2. Create a database (pick a region close to you / Vercel)  
3. Create a token with read+write  
4. Copy:
   - `LIBSQL_URL` = `libsql://….turso.io`
   - `LIBSQL_AUTH_TOKEN` = `…`

---

## 2) Local `.env.local` (laptop)

```bash
cd web
cp .env.example .env.local
```

```env
# Keep local file for copy source / desk work
SQLITE_URL=file:./data/option_chain.db

# Turso (used by seed:turso:fast and Vercel)
LIBSQL_URL=libsql://YOUR-DB.turso.io
LIBSQL_AUTH_TOKEN=YOUR_TOKEN

CRON_SECRET=   # openssl rand -hex 32
SYNC_SECRET=   # different openssl rand -hex 32
```

---

## 3) Upload local archive → Turso (FAST — one file upload)

**Do not use row-by-row `npm run seed:turso:fast` for the first load** — it burns write quota and is slow.

Use Turso’s SQLite file import instead:

```bash
cd web
# one-time: turso auth login
bash deploy/turso-import-fast.sh
```

That:
1. Sets WAL mode on the local DB  
2. Uploads `data/option_chain.db` (~8.3 GB) in one shot  
3. Creates a token and writes `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN` into `.env.local`  
4. Runs `push:stats` (KPI row from local file → 1 Turso write)

Manual equivalent:

```bash
sqlite3 data/option_chain.db "PRAGMA journal_mode=WAL; PRAGMA wal_checkpoint(TRUNCATE);"
turso db import data/option_chain.db   # or: turso db create option-chain-archive --from-file data/option_chain.db -w
turso db show option_chain --url
turso db tokens create option_chain
npm run push:stats
```

Only use `npm run seed:turso:fast` later for small incremental repairs (defaults: 2 workers / batch 40).

---

## 4) Deploy on Vercel

1. https://vercel.com/new → import `option-data-fetcher`  
2. **Root Directory** = `web`  
3. Environment variables (Production + Preview):

| Name | Value |
|------|--------|
| `LIBSQL_URL` | Turso `libsql://…` |
| `LIBSQL_AUTH_TOKEN` | Turso token |
| `CRON_SECRET` | from step 2 |
| `SYNC_SECRET` | from step 2 |

4. Deploy  
5. Cron (weekdays ~19:30 IST = 14:00 UTC): path `/api/cron/daily-sync`  
   (`vercel.json` already declares this; ensure `CRON_SECRET` is set)

---

## Rate-limit / quota protections (built in)

| Protection | What it does |
|------------|----------------|
| `archive_stats` one-row cache | Home KPIs = 1 row read, not COUNT(*) on 819k |
| No remote full scan on missing stats | Returns zeros until `push:stats` |
| In-memory status / distinct caches | Longer TTL on Turso (minutes) |
| Upload defaults `WORKERS=2` `BATCH=40` | Fewer concurrent Turso writes |
| Upload retries with long backoff on 429/quota | Survives transient rate limits |
| Vercel `Cache-Control` on browse/tree | Cuts repeat API hits |

Still avoid: running `refreshArchiveStats` / heavy audits against Turso on free tier.

---

## Day-to-day

```bash
# After local backfill, push new days + refresh KPI row
cd web
# .env.local must point LIBSQL_URL at Turso for remote sync
npm run seed:backfill
npm run push:stats
```

Or rely on Vercel cron `/api/cron/daily-sync`.

---

## Cloudflare Tunnel

Optional / abandoned for this path. Stop local tunnel services if you no longer need them:

```bash
systemctl --user stop cloudflared-oca oca-local
systemctl --user disable cloudflared-oca oca-local oca-tunnel-watch.timer
```
