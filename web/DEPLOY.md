# Deploy Option Chain Archive on Vercel (from scratch)

Complete guide: **GitHub → Turso → Vercel → seed → cron → verify**.

You do **not** need to be a developer. Follow the steps in order.

---

## What you are building

| Piece | What it does |
|-------|----------------|
| **Website** (Vercel) | Option Chain Archive UI in the browser |
| **Database** (Turso) | Cloud SQLite (libSQL) for all chain rows |
| **Cron** (Vercel) | Weekday auto-sync after market close (~5 PM IST) |

**Important:** Local `web/data/option_chain.db` does **not** persist on Vercel. Production must use **Turso**.

---

## Part A — Accounts (10 minutes)

Create free accounts:

1. **GitHub** — https://github.com  
2. **Vercel** — https://vercel.com (sign in with GitHub)  
3. **Turso** — https://turso.tech  

Optional for seeding from your laptop:

- [Node.js 20+](https://nodejs.org)  
- Turso CLI (`curl -sSfL https://get.tur.so/install.sh | bash`)

---

## Part B — GitHub repo

Repo: https://github.com/ShibayanBiswas/option-data-fetcher

The Next.js app lives in the **`web`** folder. Vercel **Root Directory** must be `web`.

```bash
git clone https://github.com/ShibayanBiswas/option-data-fetcher.git
cd option-data-fetcher
```

---

## Part C — Turso database (5 minutes)

### Website

1. Log in at https://turso.tech  
2. **Create database** → name: `option-chain-archive`  
3. Pick a region **close to your users** (e.g. Mumbai / AWS ap-south-1 if available)  
4. Copy:
   - **Database URL** → `LIBSQL_URL` (starts with `libsql://`)  
   - **Auth token** → `LIBSQL_AUTH_TOKEN`

### CLI (optional)

```bash
turso auth login
turso db create option-chain-archive
turso db show option-chain-archive --url
turso db tokens create option-chain-archive
```

Save both values in a password manager — never commit them.

---

## Part D — Vercel project (15 minutes)

### 1. Import

1. Go to https://vercel.com/new  
2. Click **Import** next to `option-data-fetcher`  
3. If the repo is not listed, connect GitHub and grant access

### 2. Configure build

| Setting | Value |
|---------|--------|
| **Framework** | Next.js (auto) |
| **Root Directory** | `web` ← critical |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `.next` (default) |
| **Install Command** | `npm install` (default) |

### 3. Environment variables

Click **Environment Variables** and add:

| Name | Value | Environments |
|------|--------|--------------|
| `LIBSQL_URL` | `libsql://…` from Turso | Production, Preview |
| `LIBSQL_AUTH_TOKEN` | Turso token | Production, Preview |
| `CRON_SECRET` | Random string (see below) | **Production only** |
| `SYNC_SECRET` | Different random string | **Production only** |

Generate secrets on your laptop:

```bash
openssl rand -hex 32   # use for CRON_SECRET
openssl rand -hex 32   # use for SYNC_SECRET (must differ)
```

### 4. Deploy

Click **Deploy**. Wait 2–5 minutes.

Your URL will look like: `https://option-data-fetcher.vercel.app`

### 5. Confirm cron (Hobby / Pro)

1. Vercel project → **Settings → Cron Jobs**  
2. You should see: `30 11 * * 1-5` → `/api/cron/daily-sync`  
3. Defined in `web/vercel.json` — no extra setup if Root Directory is `web`

> **Note:** Vercel Cron runs on **weekdays 11:30 UTC** (~17:00 IST). Requires a plan that supports cron (Hobby includes one cron on current Vercel tiers — verify in your dashboard).

---

## Part E — Seed Turso (one-time, from laptop)

A new Turso DB is empty. Fill it once:

```bash
cd web
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
LIBSQL_URL=libsql://YOUR-DB.turso.io
LIBSQL_AUTH_TOKEN=your-token
```

Pick a seed strategy:

```bash
# Fill every gap from UDiFF start (2024-01-01) → latest settled session
# INDEX + STOCK + OTHER for NSE and BSE (recommended for complete archive)
npm run seed:backfill

# Nuclear: wipe + re-download full history (hours, very large)
npm run seed:fresh

# Quick test: last 5 sessions
npm run seed 5

# INDEX full + recent STOCK only (not complete for all securities)
npm run seed:max -- --stock-days=30
```

When finished, refresh the live Vercel site — Home KPIs should show span **2024-01-01 → latest** with both exchanges populated.

---

## Part F — Post-deploy checklist (5 minutes)

| # | Test | Pass if |
|---|------|---------|
| 1 | Open `/` | KPI cards show dates and file counts |
| 2 | `/browse` | NSE \| BSE exchange picker loads |
| 3 | NSE → Index Options | Compact folder tiles (e.g. “Archived”) |
| 4 | Symbol → CALL | Trade dates oldest → newest; calendar filter works |
| 5 | One expiry | Strike table + CSV/Excel download |
| 6 | CSV Zip on `NIFTY/CALL` | Browser download starts (large zip streams) |
| 7 | `/schema` | Compact column + sector cards; NSE/BSE buttons readable |
| 8 | **Sync Today** (header) | Returns synced / already_synced on a trading day |
| 9 | Cron manual test | See below |

### Manual cron test

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR-APP.vercel.app/api/cron/daily-sync"
```

Expected: JSON with `"status": "synced"`, `"already_synced"`, or `"missing"`.

---

## Part G — Redeploy after code changes

```bash
git add .
git commit -m "Describe your change"
git push origin main
```

Vercel rebuilds automatically on push to `main`.

---

## Part H — Custom domain (optional)

1. Vercel project → **Settings → Domains**  
2. Add your domain (e.g. `archive.yourfirm.com`)  
3. Follow DNS instructions (CNAME or A record)  
4. SSL is automatic

Environment variables and cron stay the same — no re-seed needed.

---

## Environment variables (reference)

| Variable | Required | Purpose |
|----------|----------|---------|
| `LIBSQL_URL` | Yes (prod) | Turso database URL |
| `LIBSQL_AUTH_TOKEN` | Yes (prod) | Turso auth token |
| `CRON_SECRET` | Yes (prod) | Bearer for `/api/cron/daily-sync` |
| `SYNC_SECRET` | Yes (prod) | Protects `POST /api/sync` |
| *(none)* | Dev only | Omit Turso → uses `web/data/option_chain.db` |

---

## Downloads (production)

| Type | Behaviour |
|------|-----------|
| **Leaf CSV/Excel** | Single file via fetch |
| **Folder CSV Zip** | **Streamed** — safe for full INDEX CALL history |
| **Folder Excel Zip** | Capped at 250 files — use CSV Zip for larger sets |
| **Root / whole exchange** | Blocked (too large) |

Tips:

- Prefer **CSV Zip** over Excel Zip on large folders  
- Narrow path: `NSE/INDEX/NIFTY/CALL` not whole `NSE`  
- Keep tab open until large zip finishes  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Site empty | Turso env vars missing or seed not run against Turso |
| Build fails on Vercel | Root Directory must be `web` |
| Sync Unauthorized | Set `SYNC_SECRET` / `CRON_SECRET` |
| Cron never runs | Check Settings → Cron Jobs; weekday after close |
| Bhavcopy not ready | Exchange file not published — retry later |
| Download timeout | Narrow folder; use CSV Zip; try leaf file first |
| Logo hidden in dark mode | Hard refresh — logo uses CSS dark toggle |
| Excel zip error “Too many files” | Use CSV Zip or download a narrower folder |

---

## Architecture

```
NSE zip + BSE CSV bhavcopy
        │
        ▼
 Sync Today  /  weekday cron (11:30 UTC)
        │
        ▼
   Classify INDEX · STOCK · OTHER
   CALL · PUT · expiry
        │
        ▼
   Turso (prod)  or  local SQLite (dev)
        │
        ▼
   Browse · Download · Schema · Search
```

---

## Local development (optional)

```bash
cd web
npm install
cp .env.example .env.local
# Leave LIBSQL_* empty for local SQLite
npm run seed 10
npm run dev
```

Open http://localhost:3000

| Script | Meaning |
|--------|---------|
| `npm run seed N` | Last N trading days |
| `npm run seed:all` | Full calendar from 2024-01-01 (skip existing) |
| `npm run seed:backfill` | **Fill gaps** — all securities NSE+BSE to latest |
| `npm run seed:max` | Wipe → full INDEX + recent STOCK only |
| `npm run seed:fresh` | Wipe + full re-download |
| `npm run typecheck` | TypeScript check |

---

## Security

- Never commit `.env.local` or paste tokens in chat/PRs  
- Rotate Turso / cron secrets if they leak  
- `data/*.db` and `data/store` are gitignored  

You are done when: the Vercel URL loads, Browse shows NSE/BSE, KPIs have data, and Sync Today or cron can pull a fresh session.
