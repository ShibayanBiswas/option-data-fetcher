# Deploy on Vercel (legacy — not recommended for this archive)

> **Prefer [`DEPLOY-VPS.md`](./DEPLOY-VPS.md).**  
> The SQLite archive is **~8.3 GB**. Vercel has **no durable disk** for that file. Turso free-tier **rows-read** will block an archive this size (HTTP 401 / “Unable to load”).

---

## What Vercel can / cannot do

| Goal | Possible? |
|------|-----------|
| Host Next.js UI + API routes | Yes |
| Store `web/data/option_chain.db` (8 GB) | **No** |
| Use Turso as the database | Yes — **paid plan** strongly recommended |
| Free-tier Turso + full history | **No** (quota exhaustion) |

---

## If you still deploy UI on Vercel + paid Turso

1. https://vercel.com/new → Import `option-data-fetcher`
2. **Root Directory** = `web`
3. Environment variables (Production + Preview):

| Name | Value |
|------|--------|
| `LIBSQL_URL` | Turso `libsql://…` |
| `LIBSQL_AUTH_TOKEN` | Turso token |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `SYNC_SECRET` | different `openssl rand -hex 32` |

4. Deploy
5. From laptop (same Turso creds in `.env.local`):

```bash
cd web
npm run seed:turso:fast
npm run push:stats
```

6. Cron: **Settings → Cron Jobs** → `0 14 * * 1-5` → `/api/cron/daily-sync`
7. Keep Turso above free rows-read limits

---

## Recommended instead

Follow **[`DEPLOY-VPS.md`](./DEPLOY-VPS.md)**:

1. Ubuntu 24.04 VPS + Node 22.14  
2. `rsync` the local DB once  
3. `LIBSQL_URL=file:…` (no Turso)  
4. systemd or Docker + Nginx  
5. Weekday `seed-backfill` cron  
6. Point DNS to the VPS; pause Vercel / Turso  
