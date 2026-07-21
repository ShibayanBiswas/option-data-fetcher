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

There is **one** DB (`data/option_chain.db`). Cloudflare Tunnel serves it — syncing local updates the public site automatically.

```bash
bash deploy/install-daily-sync.sh
```

Weekdays **19:30 IST** via `oca-daily-sync.timer` (+ crontab backup). Log: `data/sync.log`.

Manual:

```bash
bash deploy/run-daily-sync.sh
```

## Env

