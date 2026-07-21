# Deploy: this PC + Cloudflare Tunnel + local SQLite

**This is the only supported production path.**  
Database = `web/data/option_chain.db` on this machine.  
Public access = Cloudflare Tunnel (`*.trycloudflare.com` or a named tunnel).

There is **no remote cloud SQLite** and **no Vercel database** — only the file on this PC.

---

## One-time setup

```bash
cd web
cp .env.example .env.local
# Ensure SQLITE_URL=file:./data/option_chain.db  (no remote URLs)

bash deploy/install-local-tunnel.sh
```

Services:
- `oca-local` — Next.js on `127.0.0.1:3000`
- `cloudflared-oca` — Cloudflare quick tunnel

Public URL:

```bash
journalctl --user -u cloudflared-oca -n 80 --no-pager | grep trycloudflare
```

---

## Daily sync (bhavcopy → local DB)

Already installed with the tunnel setup, or:

```cron
0 14 * * 1-5 cd "$HOME/Desktop/Option Data Fetcher/web" && SQLITE_URL=file:./data/option_chain.db npx tsx --env-file=.env.local scripts/seed-backfill.ts >> data/sync.log 2>&1
```

≈ **19:30 IST** weekdays. Also: **Sync Today** in the UI.

---

## Commands

```bash
systemctl --user status oca-local cloudflared-oca
systemctl --user restart oca-local cloudflared-oca
systemctl --user stop cloudflared-oca
npm run push:stats    # refresh KPI cache row
```

---

## Notes

- Keep this PC awake — sleep takes the site offline.
- Quick-tunnel hostnames change when `cloudflared-oca` restarts; use a named Cloudflare tunnel for a stable domain (`deploy/setup-named-tunnel.sh`).
- Full detail: [`DEPLOY-LOCAL-TUNNEL.md`](./DEPLOY-LOCAL-TUNNEL.md)
