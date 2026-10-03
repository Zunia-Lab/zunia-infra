#!/usr/bin/env bash
# Pull origin/main and rebuild only the apps whose git revision moved.
# Installed at /srv/zunia/shared/redeploy.sh and started by zunia-redeploy.timer.
# Server-side dashboard calls stay on loopback. The browser bundle uses
# https://api.zunialab.com, which is baked in at `next build`.
set -euo pipefail

export PATH="/srv/zunia/toolchain/node/bin:/usr/sbin:/usr/bin:/bin"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
ROOT=/srv/zunia/repos
LOCK=/srv/zunia/shared/redeploy.lock
DASH_ENV=/srv/zunia/shared/dashboard.env

mkdir -p /srv/zunia/shared
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "redeploy already running"
  exit 0
fi

log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*"; }

as_zunia() {
  # SCRIPT is the child program. stdin is closed so git cannot eat it.
  sudo -u zunia env \
    PATH="$PATH" \
    NODE_OPTIONS="$NODE_OPTIONS" \
    HOME=/home/zunia \
    SCRIPT="$1" \
    bash --noprofile --norc -c 'set -euo pipefail; eval "$SCRIPT"' </dev/null
}

ensure_dashboard_env() {
  umask 077
  touch "$DASH_ENV"
  chown zunia:zunia "$DASH_ENV"
  python3 - "$DASH_ENV" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
wanted = {
    "INDEXER_URL": "http://127.0.0.1:8787",
    "BACKEND_URL": "http://127.0.0.1:8788",
    "NEXT_PUBLIC_ZUNIA_CONNECT_API_BASE": "https://api.zunialab.com",
}
lines = path.read_text().splitlines() if path.exists() else []
seen = set()
out = []
for line in lines:
    key = line.split("=", 1)[0] if "=" in line and not line.startswith("#") else None
    if key in wanted:
        out.append(f"{key}={wanted[key]}")
        seen.add(key)
    else:
        out.append(line)
for key, value in wanted.items():
    if key not in seen:
        out.append(f"{key}={value}")
path.write_text("\n".join(out).rstrip() + "\n")
PY
  install -m 600 "$DASH_ENV" "$ROOT/zunia-dashboard/.env.production.local"
  chown zunia:zunia "$ROOT/zunia-dashboard/.env.production.local"
}

ensure_connect_public_url() {
  python3 - <<'PY'
import pathlib
path = pathlib.Path("/srv/zunia/shared/backend.env")
if not path.exists():
    print("backend-env-missing")
    raise SystemExit(0)
lines = path.read_text().splitlines()
out = []
changed = False
for line in lines:
    if line.startswith("CONNECT_WS_PUBLIC_URL="):
        value = line.split("=", 1)[1].strip().strip('"').strip("'")
        if "localhost" in value or "127.0.0.1" in value or value.startswith("ws://"):
            out.append("CONNECT_WS_PUBLIC_URL=wss://api.zunialab.com")
            changed = True
            continue
    out.append(line)
if changed:
    path.write_text("\n".join(out).rstrip() + "\n")
    print("connect-ws-updated")
else:
    print("connect-ws-ok")
PY
}

# Echoes "changed" or "same". Does not build.
pull_repo() {
  local name="$1"
  as_zunia "cd '$ROOT/$name' && git fetch origin main && head_rev=\$(git rev-parse HEAD) && upstream=\$(git rev-parse origin/main) && if [ \"\$head_rev\" = \"\$upstream\" ]; then echo same; else git pull --ff-only origin main && echo changed; fi"
}

build_repo() {
  local name="$1"
  log "build $name"
  if [ "$name" = "zunia-dashboard" ]; then
    as_zunia "set -a && . '$DASH_ENV' && set +a && cd '$ROOT/$name' && pnpm install --frozen-lockfile && pnpm build"
  else
    as_zunia "cd '$ROOT/$name' && pnpm install --frozen-lockfile && pnpm build"
  fi
}

sync_infra() {
  log "install nginx, status brand, and units"
  install -d -m 755 /srv/zunia/shared/status-brand
  if [ -d "$ROOT/zunia-infra/deploy/uptime-kuma/brand" ]; then
    install -m 644 "$ROOT/zunia-infra/deploy/uptime-kuma/brand/"* /srv/zunia/shared/status-brand/
  fi
  local conf
  for conf in "$ROOT/zunia-infra/deploy/nginx/"*.conf; do
    install -m 644 "$conf" "/etc/nginx/sites-available/$(basename "$conf")"
  done
  install -m 755 "$ROOT/zunia-infra/deploy/redeploy/redeploy.sh" /srv/zunia/shared/redeploy.sh
  install -m 644 "$ROOT/zunia-infra/deploy/systemd/zunia-redeploy.service" /etc/systemd/system/zunia-redeploy.service
  install -m 644 "$ROOT/zunia-infra/deploy/systemd/zunia-redeploy.timer" /etc/systemd/system/zunia-redeploy.timer
  install -m 644 "$ROOT/zunia-infra/deploy/systemd/zunia-dashboard.service" /etc/systemd/system/zunia-dashboard.service
  install -m 644 "$ROOT/zunia-infra/deploy/systemd/zunia-updates.service" /etc/systemd/system/zunia-updates.service
  install -m 644 "$ROOT/zunia-infra/deploy/systemd/zunia-mapzone.service" /etc/systemd/system/zunia-mapzone.service
  ln -sfn /etc/nginx/sites-available/updates.zunialab.com.conf /etc/nginx/sites-enabled/updates.zunialab.com.conf
  ln -sfn /etc/nginx/sites-available/ibcmap.zunialab.com.conf /etc/nginx/sites-enabled/ibcmap.zunialab.com.conf
  nginx -t
  systemctl reload nginx
  systemctl daemon-reload
  systemctl enable --now zunia-redeploy.timer
}

ensure_dashboard_env
connect_note="$(ensure_connect_public_url)"
log "$connect_note"

ui=same
sdk=same
website=same
dashboard=same
docs=same
backend=same
indexer=same
infra=same
updates=same
mapzone=same

ui="$(pull_repo zunia-ui | tail -n 1)"
sdk="$(pull_repo zunia-sdk | tail -n 1)"
website="$(pull_repo zunia-website | tail -n 1)"
dashboard="$(pull_repo zunia-dashboard | tail -n 1)"
docs="$(pull_repo zunia-docs | tail -n 1)"
backend="$(pull_repo zunia-backend | tail -n 1)"
indexer="$(pull_repo zunia-indexer | tail -n 1)"
infra="$(pull_repo zunia-infra | tail -n 1)"
if [ -d "$ROOT/zunia-updates" ]; then
  updates="$(pull_repo zunia-updates | tail -n 1)"
fi
if [ -d "$ROOT/zunia-mapzone" ]; then
  mapzone="$(pull_repo zunia-mapzone | tail -n 1)"
fi

log "ui=$ui sdk=$sdk website=$website dashboard=$dashboard docs=$docs backend=$backend indexer=$indexer infra=$infra updates=$updates mapzone=$mapzone"

if [ "$ui" = "changed" ]; then
  build_repo zunia-ui
  website=changed
  dashboard=changed
  if [ -d "$ROOT/zunia-updates" ]; then
    updates=changed
  fi
  if [ -d "$ROOT/zunia-mapzone" ]; then
    mapzone=changed
  fi
fi
if [ "$sdk" = "changed" ]; then
  build_repo zunia-sdk
  dashboard=changed
fi
if [ "$website" = "changed" ]; then
  build_repo zunia-website
  systemctl restart zunia-website
fi
if [ "$dashboard" = "changed" ]; then
  build_repo zunia-dashboard
  systemctl restart zunia-dashboard
fi
if [ "$docs" = "changed" ]; then
  build_repo zunia-docs
fi
if [ "$backend" = "changed" ]; then
  build_repo zunia-backend
  as_zunia "set -a && . /srv/zunia/shared/backend.env && set +a && cd '$ROOT/zunia-backend' && pnpm db:migrate"
  systemctl restart zunia-backend
elif [ "$connect_note" = "connect-ws-updated" ]; then
  systemctl restart zunia-backend
fi
if [ "$indexer" = "changed" ]; then
  build_repo zunia-indexer
  as_zunia "set -a && . /srv/zunia/shared/indexer.env && set +a && cd '$ROOT/zunia-indexer' && pnpm db:migrate"
  systemctl restart zunia-indexer
fi
if [ "$updates" = "changed" ]; then
  if [ ! -f /srv/zunia/shared/updates.env ]; then
    log "updates.env missing, skip zunia-updates"
  else
    log "build zunia-updates"
    as_zunia "set -a && . /srv/zunia/shared/updates.env && set +a && cd '$ROOT/zunia-updates' && pnpm install --frozen-lockfile && pnpm build && pnpm db:migrate"
    systemctl restart zunia-updates
  fi
fi
if [ "$mapzone" = "changed" ]; then
  if [ ! -f /srv/zunia/shared/mapzone.env ]; then
    log "mapzone.env missing, skip zunia-mapzone"
  else
    build_repo zunia-mapzone
    systemctl restart zunia-mapzone
  fi
fi
if [ "$infra" = "changed" ]; then
  sync_infra
fi

log "done"
