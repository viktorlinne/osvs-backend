#!/usr/bin/env bash
# Deploy OSVS (backend + frontend) on the Ubuntu server.
# Run as the `osvs` user from anywhere:  /opt/osvs/osvs-backend/deploy/deploy.sh
# The `osvs` user needs passwordless sudo for exactly:
#   /usr/bin/systemctl restart osvs-backend
# (see deploy/README.md).
#
# Steps: pull both repos -> install + build -> backup DB -> migrate ->
# publish frontend -> restart backend -> health check. Stops on the first error.

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/osvs}"
BACKEND="$APP_ROOT/osvs-backend"
FRONTEND="$APP_ROOT/osvs-frontend"
WEB_ROOT="${WEB_ROOT:-/var/www/osvs}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/api/health}"

log() { printf '\n==> %s\n' "$*"; }

log "Pull ($BRANCH)"
git -C "$BACKEND" fetch --quiet origin
git -C "$BACKEND" checkout --quiet "$BRANCH"
git -C "$BACKEND" pull --ff-only --quiet origin "$BRANCH"
git -C "$FRONTEND" fetch --quiet origin
git -C "$FRONTEND" checkout --quiet "$BRANCH"
git -C "$FRONTEND" pull --ff-only --quiet origin "$BRANCH"
echo "backend  $(git -C "$BACKEND" log -1 --format='%h %s')"
echo "frontend $(git -C "$FRONTEND" log -1 --format='%h %s')"

log "Backend: install + build"
cd "$BACKEND"
npm ci --no-audit --no-fund
npm run build

log "Frontend: install + build (same-origin API: VITE_BACKEND_URL empty)"
cd "$FRONTEND"
npm ci --no-audit --no-fund
VITE_BACKEND_URL="" npm run build

log "Database backup before migrating"
"$BACKEND/deploy/backup.sh"

log "Migrate (compiled runner, no ts-node needed)"
cd "$BACKEND"
MIGRATE_ALLOW_PRODUCTION=true MIGRATE_ALLOW_ANY_DB=true npm run migrate:prod

log "Publish frontend to $WEB_ROOT"
rsync -a --delete "$FRONTEND/dist/" "$WEB_ROOT/"

log "Restart backend"
sudo /usr/bin/systemctl restart osvs-backend

log "Health check"
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    echo "healthy after ${i}s"
    exit 0
  fi
  sleep 1
done
echo "Health check FAILED: $HEALTH_URL" >&2
# osvs is in the systemd-journal group (see README), so no sudo needed here.
journalctl -u osvs-backend -n 50 --no-pager >&2 || true
exit 1
