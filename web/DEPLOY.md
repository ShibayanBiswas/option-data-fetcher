# Deploy Option Chain Archive on Vercel (corrected guide)

**GitHub → Turso → Vercel → fast seed → cron → verify**

---

## What you deploy

| Piece | Role |
|--------|------|
| **Vercel** | Next.js app — **Root Directory must be `web`** |
| **Turso** | Cloud SQLite for all chain data |
| **Cron** | Weekdays **14:00 UTC ≈ 19:30 IST** → `/api/cron/daily-sync` |

Local `web/data/option_chain.db` does **not** persist on Vercel. Production uses Turso.

---

## Step 1 — Turso database

1. https://app.turso.tech → create DB `option-chain-archive` (region `aws-ap-south-1` is fine)
2. Copy:
   - **URL** → `LIBSQL_URL` (starts with `libsql://`)
   - **Token** → `LIBSQL_AUTH_TOKEN` (create token; save once)

Example URL shape:

```text
libsql://option-chain-archive-YOURNAME.aws-ap-south-1.turso.io
```

---

## Step 2 — Vercel project

1. https://vercel.com/new → Import `option-data-fetcher`
2. Settings:

| Setting | Value |
|---------|--------|
| **Root Directory** | `web` |
| Framework | Next.js |
| Build | `npm run build` |

3. **Environment Variables** (Production + Preview):

| Name | Value |
|------|--------|
| `LIBSQL_URL` | your Turso `libsql://…` URL |
| `LIBSQL_AUTH_TOKEN` | your Turso token |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `SYNC_SECRET` | different `openssl rand -hex 32` |

4. **Deploy**

5. Confirm cron: **Settings → Cron Jobs** → `0 14 * * 1-5` → `/api/cron/daily-sync`

---

## Step 3 — Fast seed Turso (from laptop)

You need a full local archive first (you already have `web/data/option_chain.db` with ~816k rows).

```bash
cd option-data-fetcher/web
npm install
```

Put credentials in `.env.local` (gitignored):

```env
LIBSQL_URL=libsql://option-chain-archive-YOURNAME.aws-ap-south-1.turso.io
LIBSQL_AUTH_TOKEN=your-token
CRON_SECRET=…
SYNC_SECRET=…
```

**Wipe Turso + parallel copy (recommended):**

```bash
# 8 parallel writers (default). Optional knobs:
# TURSO_WORKERS=12 TURSO_BATCH=100 npm run seed:turso:fast
npm run seed:turso:fast
```

What it does:
1. Deletes all remote rows  
2. Copies local SQLite → Turso with **8 parallel workers**  
3. Backfills any newer NSE/BSE sessions after the local max date  

Check progress / final state:

```bash
npm run check:turso
```

Expect roughly: span **2024-01-01 → latest**, ~800k+ docs, NSE+BSE both populated.

### Other seed commands

| Command | Use when |
|---------|----------|
| `npm run seed:turso:fast` | **Best** — wipe + parallel local→Turso |
| `npm run seed:backfill` | Re-download missing days from bhavcopy (slow) |
| `npm run seed:fresh` | Wipe local too + re-download everything (hours) |
| `npm run seed 5` | Quick 5-day smoke test |

---

## Step 4 — Verify live site

| Check | Pass if |
|-------|---------|
| `/` | KPIs show start/end dates + counts |
| `/browse` | NSE \| BSE works |
| CSV Zip | Folder downloads as `.zip` of CSVs only (no Excel) |
| **Sync Today** | synced / already_synced / missing — writes to Turso |
| Cron curl | see below |

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR-APP.vercel.app/api/cron/daily-sync"
```

---

## Day-2 automatic ops

| Mechanism | When |
|-----------|------|
| Vercel Cron | Weekdays ~19:30 IST → Turso |
| Sync Today | Manual anytime → Turso |
| Quiet catch-up | First visit each IST day auto-syncs latest session |
| Live UI | End Date / KPIs / calendars refresh without waiting for redeploy |
| `git push main` | Auto-redeploy (no re-seed) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Empty site | Turso env missing **or** seed not finished |
| Build fails | Root Directory ≠ `web` |
| Suspense / useSearchParams | Fixed on `main` — redeploy latest |
| Copy DNS / fetch failed | Re-run `npm run seed:turso:fast` (wipes + retries) |
| Cron Unauthorized | Set `CRON_SECRET` on Vercel |

---

## Architecture

```
Local SQLite (full history)
        │  npm run seed:turso:fast  (wipe + 8 parallel writers)
        ▼
     Turso (prod)
        │
        ├── Vercel UI (browse / CSV download / schema)
        └── Cron 14:00 UTC + Sync Today  (daily updates → Turso)
```

You are done when: Vercel build is green, KPIs show full span, Sync Today works, cron is scheduled.
