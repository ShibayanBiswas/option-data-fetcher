# Deploy Option Chain Archive (for beginners)

This guide takes you from **zero** to a **live website** that updates itself every weekday after market close.

You do **not** need to be a developer. Follow the steps in order.

---

## What you are building

| Piece | What it does |
|-------|----------------|
| **Website** (Vercel) | The Option Chain Archive UI people open in a browser |
| **Database** (Turso) | Stores option-chain rows in the cloud (SQLite-compatible) |
| **Nightly job** (Vercel Cron) | Pulls the latest NSE/BSE bhavcopy on weekdays ~5:00 PM IST |

Local laptop = `file:./data/option_chain.db`  
Live site on Vercel = **Turso** (a local `.db` file **will not** survive on Vercel)

---

## Before you start (accounts)

Create free accounts (email signup is fine):

1. **GitHub** — https://github.com  
2. **Vercel** — https://vercel.com (sign in with GitHub)  
3. **Turso** — https://turso.tech  

Optional on your PC:

- [Node.js 20+](https://nodejs.org) (only if you want to run the app locally)
- Turso CLI (for creating the database from a terminal)

---

## Step 1 — Put the code on GitHub

If the repo already exists at  
https://github.com/ShibayanBiswas/option-data-fetcher  
you can skip cloning and go to Step 2.

Otherwise:

1. Open the repo on GitHub.
2. Click **Code → Download ZIP**, or clone it:

```bash
git clone https://github.com/ShibayanBiswas/option-data-fetcher.git
cd option-data-fetcher
```

The website lives in the **`web`** folder. That folder is what Vercel must deploy.

---

## Step 2 — Create the Turso database

### Easy path (Turso website)

1. Log in at https://turso.tech  
2. Create a new database named e.g. `option-chain-archive`  
3. Copy:
   - **Database URL** → this becomes `LIBSQL_URL`  
   - **Auth token** → this becomes `LIBSQL_AUTH_TOKEN`  

### Terminal path

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create option-chain-archive
turso db show option-chain-archive --url
turso db tokens create option-chain-archive
```

Save both values in a notepad. You will paste them into Vercel next.

---

## Step 3 — Import the project on Vercel

1. Go to https://vercel.com/new  
2. **Import** the GitHub repo `option-data-fetcher`  
3. Open **Root Directory** → set it to **`web`** (important!)  
4. Framework: **Next.js** (auto-detected)  
5. Do **not** change Build Command (`npm run build`)  
6. Click **Environment Variables** and add:

| Name | Value | Where |
|------|--------|--------|
| `LIBSQL_URL` | Turso URL (`libsql://…`) | Production + Preview |
| `LIBSQL_AUTH_TOKEN` | Turso token | Production + Preview |
| `CRON_SECRET` | Any long random string (e.g. password generator) | Production |
| `SYNC_SECRET` | Another random string | Production |

7. Click **Deploy**

Wait until the deploy finishes. You will get a URL like  
`https://option-data-fetcher.vercel.app`

---

## Step 4 — Put data into Turso (one-time seed)

A brand-new Turso DB is empty. Fill it once from your laptop:

```bash
cd web
npm install
cp .env.example .env.local
```

Edit `.env.local` and set the **same** Turso values:

```env
LIBSQL_URL=libsql://YOUR-DB.turso.io
LIBSQL_AUTH_TOKEN=your-token
```

Then seed (pick one):

```bash
# Faster demo: full INDEX history + last 30 STOCK sessions
npm run seed:max -- --stock-days=30

# Full wipe + download everything (hours; large)
npm run seed:fresh
```

When it finishes, refresh your Vercel site. Home KPIs and Browse should show dates and symbols.

---

## Step 5 — Daily auto-sync (already wired)

The file `web/vercel.json` schedules:

```
Weekdays 11:30 UTC  ≈  17:00 IST
→ GET /api/cron/daily-sync
```

### Checklist so it actually runs

1. Vercel project → **Settings → Cron Jobs** — confirm the job exists  
2. `CRON_SECRET` is set on the project  
3. After market close on a trading day, open Browse or tap **Sync Today** once to verify  

Manual test (replace secrets/URL):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR-APP.vercel.app/api/cron/daily-sync"
```

You should get JSON with `"status": "synced"` or `"already_synced"` / `"missing"` (holiday / file not published yet).

---

## Step 6 — How people use the live site

| Action | How |
|--------|-----|
| Browse archive | Open **/browse** — left tree + right panel scroll separately |
| Jump fast | Press **⌘K** (Mac) or **Ctrl+K** (Windows) |
| Latest session | Click **Sync Today** in the header |
| Schema map | Open **/schema** — horizontal card rows + exchange flowchart |
| Download | CSV / Excel on folders (zip) or on an expiry leaf (single file) |

Tree shape:

```
NSE | BSE
 └── Index Options | Stock Options | Other Securities
      └── Symbol (stocks under sector folders)
           └── CALL | PUT
                └── Trade date (newest → oldest; calendar filter)
                     └── Expiry file (strike ladder)
```

---

## Step 7 — Local development (optional)

```bash
cd web
npm install
cp .env.example .env.local
# Leave LIBSQL_* empty to use local file DB:
#   data/option_chain.db
npm run seed 5
npm run dev
```

Open http://localhost:3000

| Script | Meaning |
|--------|---------|
| `npm run seed N` | Last N trading days |
| `npm run seed:all` | All calendar sessions |
| `npm run seed:fresh` | Wipe + full re-download |
| `npm run seed:max` | INDEX full + recent STOCK |
| `npm run ingest:local` | Load existing `data/store` CSVs into SQLite |

---

## Troubleshooting (plain English)

| Problem | Fix |
|---------|-----|
| Site opens but archive is empty | Turso env vars missing, or you never ran a seed against Turso |
| Sync says Unauthorized | Set `SYNC_SECRET` / `CRON_SECRET` and use the Bearer header for cron |
| Cron never updates | Confirm Root Directory is `web`, cron job enabled, weekday after settlement |
| “Bhavcopy not ready” | Exchange file not published yet — try again later or next session |
| Huge DB / Turso quota | Prefer `seed:max` (INDEX full + limited STOCK days) |
| Buttons looked duplicated | Fixed — expiry pages show one CSV/Excel pair in the header only |
| Sidebar and page scrolled together | Fixed — each pane scrolls on its own inside the desk layout |

---

## Security (do this)

- Never commit `.env.local` or paste tokens into chat/PRs  
- Rotate Turso / cron secrets if they leak  
- `data/*.db` and `data/store` are gitignored — keep archives off GitHub  

---

## Architecture (one picture)

```
NSE zip + BSE CSV bhavcopy
        │
        ▼
 Sync Today  /  weekday cron
        │
        ▼
   Classify FinInstrmTp
   INDEX · STOCK · OTHER
   CALL · PUT · expiry
        │
        ▼
   Turso (prod)  or  local SQLite (dev)
        │
        ▼
   Browse · Download · Search · Schema
```

You are done when: the Vercel URL loads, Browse shows NSE/BSE, and weekday cron (or Sync Today) can pull a fresh session.
