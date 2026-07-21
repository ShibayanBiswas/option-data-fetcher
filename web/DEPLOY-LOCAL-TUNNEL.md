# Run on this PC + Cloudflare Tunnel

Expose the local `option_chain.db` (~8.3 GB) via Cloudflare Tunnel.

## Install / restart

```bash
cd web
bash deploy/install-local-tunnel.sh
```

Services (user systemd):
- `oca-local` — Next.js on `127.0.0.1:3000` with file SQLite
- `cloudflared-oca` — quick tunnel → `*.trycloudflare.com`

## Public URL

```bash
journalctl --user -u cloudflared-oca -n 80 --no-pager | grep trycloudflare
```

Quick-tunnel hostnames **change** when the tunnel service restarts.

## Keep the PC awake

Sleep/hibernate takes the site offline.

## Daily sync

```cron
0 14 * * 1-5 cd "$HOME/Desktop/Option Data Fetcher/web" && LIBSQL_URL=file:./data/option_chain.db npx tsx --env-file=.env.production scripts/seed-backfill.ts >> data/sync.log 2>&1
```

## Commands

```bash
systemctl --user status oca-local cloudflared-oca
systemctl --user restart oca-local cloudflared-oca
systemctl --user stop cloudflared-oca
```
