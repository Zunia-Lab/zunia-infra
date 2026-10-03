# Hetzner host

`zunialab.com` is served from the Hetzner box in `hel1` (`65.108.104.223`), not from Vercel. Cloudflare proxies DNS (orange cloud). nginx terminates TLS and reverse-proxies the apps, which listen on localhost only.

This host also runs other sites. Do not enable a host-wide firewall that would close their ports. Postgres and the app ports stay on `127.0.0.1`.

## Hosts

| Host | Process | Bind |
|------|---------|------|
| `zunialab.com`, `www` | `zunia-website` | `127.0.0.1:3010` |
| `link.zunialab.com` | same website (App Links) | `127.0.0.1:3010` |
| `docs.zunialab.com` | static `zunia-docs/build` | nginx root |
| `wallet.zunialab.com` | `zunia-dashboard` | `127.0.0.1:3012` |
| `api.zunialab.com`, `backend.zunialab.com` | `zunia-backend` | `127.0.0.1:8788` |
| `indexer.zunialab.com` | `zunia-indexer` | `127.0.0.1:8787` |
| `status.zunialab.com` | Uptime Kuma | `127.0.0.1:3015` |
| `updates.zunialab.com` | `zunia-updates` | `127.0.0.1:3016` |
| `ibcmap.zunialab.com` | `zunia-mapzone` (Map Zone) | `127.0.0.1:3017` |

`3010` and `3012` are used because `3000` and `3001` are already taken on this machine. Connect WebSocket is `wss://api.zunialab.com/v1/connect/ws`.

Leave `mail.zunialab.com` on the mail host.

## Layout

```
/srv/zunia/repos/          git checkouts (siblings, so pnpm link:../ works)
/srv/zunia/toolchain/node  Node 22 + pnpm
/srv/zunia/shared/*.env    mode 600, not in git
/srv/zunia/shared/mapzone/ Map Zone engine state (registry cache, logos, rolling stats)
/etc/nginx/sites-enabled/  copies of deploy/nginx/*.conf
/etc/systemd/system/       copies of deploy/systemd/*.service
```

## Pull and rebuild

```bash
export PATH=/srv/zunia/toolchain/node/bin:$PATH
cd /srv/zunia/repos/zunia-ui && git pull --ff-only && pnpm install --frozen-lockfile && pnpm build
cd /srv/zunia/repos/zunia-sdk && git pull --ff-only && pnpm install --frozen-lockfile && pnpm build
for repo in zunia-website zunia-dashboard zunia-docs zunia-backend zunia-indexer zunia-updates; do
  cd /srv/zunia/repos/$repo
  git pull --ff-only
  pnpm install --frozen-lockfile
  pnpm build
done
set -a; . /srv/zunia/shared/backend.env; set +a
cd /srv/zunia/repos/zunia-backend && pnpm db:migrate
set -a; . /srv/zunia/shared/indexer.env; set +a
cd /srv/zunia/repos/zunia-indexer && pnpm db:migrate
sudo systemctl restart zunia-website zunia-dashboard zunia-backend zunia-indexer zunia-updates
```

`zunia-redeploy.timer` runs that pull on its own, every two minutes, and only rebuilds a repo whose `origin/main` moved. `zunia-ui` or `zunia-sdk` moving also rebuilds the apps that link them. The browser connect URL baked into the dashboard is `https://api.zunialab.com`. The dashboard process on this host still calls the indexer and backend on `127.0.0.1`.

Build `zunia-ui` and `zunia-sdk` before the Next apps. Their packages are linked, not published.

## TLS

One Let's Encrypt certificate, DNS-01 via Cloudflare, so the orange-cloud proxy can stay on:

```bash
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d zunialab.com -d www.zunialab.com -d docs.zunialab.com \
  -d wallet.zunialab.com -d api.zunialab.com -d backend.zunialab.com \
  -d indexer.zunialab.com -d link.zunialab.com -d status.zunialab.com \
  -d updates.zunialab.com -d ibcmap.zunialab.com
```

`/etc/letsencrypt/cloudflare.ini` is mode 600 and is not in git. Cloudflare SSL mode is Full (strict). WebSockets are enabled on the zone.

nginx snippets live in `deploy/nginx/`. The Connect location sets `Upgrade` and a one-hour read timeout.

## Status

Uptime Kuma runs in Docker (`deploy/uptime-kuma/compose.yaml`) and only listens on `127.0.0.1:3015`. `status.zunialab.com` is mapped to the public status page. The admin UI is the same port over an SSH tunnel, not a public path.

A timer (`zunia-connect-ws-probe`) opens a real Connect session once a minute and pushes the handshake result. A bare WebSocket to `/v1/connect/ws` is refused, so that probe is what makes the WSS row honest.

## Postgres

Local cluster only. Role `zunia_app` owns `zunia_backend`, `zunia_indexer`, and `zunia_updates`. Connection strings are in `/srv/zunia/shared/backend.env`, `indexer.env`, and `updates.env`.

`updates.env` also holds `ADMIN_TOKEN`, the Turnstile keys, and optional Cloudflare Access settings. Create the database before the first boot:

```bash
sudo -u postgres createdb -O zunia_app zunia_updates
```

The Turnstile widget and the Access application for `updates.zunialab.com/admin` are created in the Cloudflare dashboard. DNS is a proxied A/AAAA for `updates`, same addresses as the other hosts. Reissue the certificate after adding the name, using the `certbot` command above.

## Map Zone

`ibcmap.zunialab.com` runs `zunia-mapzone`: one long-lived Next.js process whose engine holds WebSocket subscriptions to the chains' public RPC nodes, reads the Cosmos chain registry from GitHub every six hours, and streams to browsers over Server-Sent Events (`/api/stream`, unbuffered in nginx, pinged every 15 s).

- Unit `zunia-mapzone.service`, env `/srv/zunia/shared/mapzone.env` (mode 600): `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (the `zunialab.com` Turnstile widget, which covers subdomains), `MAPZONE_GATE_SECRET` (HMAC key for the pass cookie), `MAPZONE_GATE_HOSTS=ibcmap.zunialab.com`, `TRUST_PROXY=cloudflare`. Optional: `COINGECKO_API_KEY`, `GITHUB_TOKEN`.
- State in `/srv/zunia/shared/mapzone/`, owned by `zunia`. Deleting it is safe: the registry is rebuilt from GitHub (or the committed seed) and the rolling windows start empty, which the UI reports as not observed.
- `/api/health` reports the registry, streaming zones and connected viewers.
- The redeploy timer rebuilds it when `zunia-mapzone` or `zunia-ui` moves; it is skipped while `mapzone.env` is missing.

