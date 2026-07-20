# Option Chain Archive

Anand Rathi Wealth desk web app for browsing and downloading historical Indian option chain data from **NSE** and **BSE** F&O bhavcopy.

## Quick start

```bash
cd web
npm install
npm run seed 10
npm run dev
```

Open http://localhost:3000

- **Browse** — full hierarchy with sector grouping for stocks
- **Schema** — archive tree and field map
- **⌘K** — smart search
- **Sync Today** — themed status popup

Full docs: [`web/README.md`](web/README.md)

## Deploy

Deploy the `web` folder. Set `MONGODB_URI`, `MONGODB_DB`, `CRON_SECRET`, `SYNC_SECRET`.
Weekday cron refreshes MongoDB after market close — no separate backend host required.
