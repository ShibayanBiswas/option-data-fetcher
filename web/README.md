# Option Chain Archive

Web app for browsing and downloading historical Indian option chain data from **NSE** and **BSE** F&O bhavcopy.

## Quick start

```bash
cd web
npm install
cp .env.example .env.local   # set MONGODB_URI
npm run seed 10              # deepen archive (UDiFF era)
npm run dev                  # http://localhost:3000
```

## Hierarchy

```
NSE | BSE
 └── INDEX | STOCK | OTHER (only if present)
      └── Symbol (sector-tagged for stocks)
           └── CALL | PUT
                └── Trade date (YYYY-MM-DD)
                     └── expiry_date_YYYY-MM-DD  ← strike-sorted table / CSV
```

Segregation uses UDiFF `FinInstrmTp`: **IDO → INDEX**, **STO → STOCK**, anything else → **OTHER**.

## Desk features

- Full-width layout aligned to the Primary SP Dashboard look
- Smart search (`⌘K`) across exchanges, sectors, indices, and stocks
- Stock sector grouping on the STOCK browse level
- Schema page documenting the archive tree and field map
- Themed Sync Today dialogs (synced, already synced, missing, partial, failed)
- CSV / Excel zip downloads at folder levels; plain CSV / Excel at expiry leaves
- MongoDB Atlas (Mumbai) as source of truth + local `data/store` in development
- Weekday scheduled refresh after market close (platform cron config)


## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local desk UI |
| `npm run seed N` | Pull last N trading days into MongoDB |
| `npm run audit:segments` | Verify FinInstrmTp segregation |
| `npm run reclassify` | Fix segment paths after classifier changes |
| `npm run typecheck` | TypeScript check |

## Deploy

Deploy the `web` folder. Set `MONGODB_URI`, `MONGODB_DB`, `CRON_SECRET`, `SYNC_SECRET`.
Cron hits `/api/cron/daily-sync` on weekdays at 11:30 UTC (~17:00 IST).

## Manual sync

- UI: **Sync Today** (themed popup)
- API: `POST /api/sync` with `{}` (smart latest), `{ "date": "YYYY-MM-DD" }`, or `{ "seed": true, "days": 10, "force": true }`
- Cron: `GET /api/cron/daily-sync` with `Authorization: Bearer $CRON_SECRET`

## Historical depth

NSE/BSE UDiFF option bhavcopy coverage begins around mid-2024. Seed as many trading days as Atlas storage allows; the home **Coverage and depth** KPIs show the live span.
