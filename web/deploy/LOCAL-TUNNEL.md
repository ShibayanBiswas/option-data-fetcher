# Local PC + Cloudflare Tunnel


## Limits

- Site is **down when this PC sleeps / is offline**
- Quick-tunnel URL **changes** every restart
- For a stable hostname on your domain: `cloudflared tunnel login` + named tunnel (optional later)

## One-command start

```bash
cd web
bash deploy/start-local-tunnel.sh
```

Open the printed `https://….trycloudflare.com` URL.

Stop:

```bash
bash deploy/stop-local-tunnel.sh
```

## Optional: start on login (systemd user)

```bash
bash deploy/install-local-tunnel-services.sh
systemctl --user start oca-archive oca-tunnel
# Public URL appears in ~/.config/oca/logs/tunnel.log
```

## Daily sync (local)

```bash
cd web
LIBSQL_URL=file:./data/option_chain.db npx tsx --env-file=.env.tunnel scripts/seed-backfill.ts
```

Or cron (user crontab):

```cron
0 14 * * 1-5 cd /home/USER/Desktop/Option\ Data\ Fetcher/web && LIBSQL_URL=file:./data/option_chain.db /usr/bin/npx tsx --env-file=.env.tunnel scripts/seed-backfill.ts >> ~/.config/oca/logs/sync.log 2>&1
```

## Env

