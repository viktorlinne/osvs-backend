#!/usr/bin/env bash
# Deploy OSVS (backend + frontend) on the Ubuntu server.
# Run as the `osvs` user from anywhere:  /opt/osvs/osvs-backend/deploy/deploy.sh
# The `osvs` user needs passwordless sudo for exactly:
#   /usr/bin/systemctl restart osvs-backend
# (see deploy/README.md).
#
# Steps: pull both repos -> install + build (backend into dist.next, the
# running service keeps using dist/) -> backup DB -> migrate -> switch
# dist.next to dist -> restart backend -> health check -> publish frontend.
# Stops on the first error. Before the switch, a failure leaves the running
# backend and the published frontend untouched (but see "node_modules" in
# deploy/README.md section 7). Rollback: deploy/README.md section 7.
#
# Migrations run while the OLD backend still serves requests, so every
# migration must be compatible with the previous code (add, don't rename or
# drop, in the same release).

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/osvs}"
BACKEND="$APP_ROOT/osvs-backend"
FRONTEND="$APP_ROOT/osvs-frontend"
WEB_ROOT="${WEB_ROOT:-/var/www/osvs}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/api/health}"
HISTORY="$APP_ROOT/deploy-history.log"
# Old hashed frontend assets are kept this long, so browsers that still run
# the previous index.html can load their lazy chunks after a deploy.
KEEP_OLD_ASSETS_DAYS="${KEEP_OLD_ASSETS_DAYS:-14}"
# swagger-ui-express pulls in @scarf/scarf, which phones home on install.
export SCARF_ANALYTICS=false

log() { STEP="$*"; printf '\n==> %s\n' "$*"; }
die() { printf '\nDEPLOY FAILED: %s\n' "$*" >&2; exit 1; }

# One deploy at a time (two overlapping runs would build into the same dirs).
exec 9>"$APP_ROOT/.deploy.lock"
flock -n 9 || die "another deploy is running ($APP_ROOT/.deploy.lock)"

for repo in "$BACKEND" "$FRONTEND"; do
  if ! git -C "$repo" diff --quiet || ! git -C "$repo" diff --cached --quiet; then
    die "$repo has local changes; commit or discard them first"
  fi
done

PREV_BACKEND="$(git -C "$BACKEND" rev-parse HEAD)"
PREV_FRONTEND="$(git -C "$FRONTEND" rev-parse HEAD)"
NEW_BACKEND="?"
STEP="start"
record_failure() {
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "$(date -Is) FAILED at '$STEP' (exit $rc) backend ${PREV_BACKEND:0:7}->${NEW_BACKEND:0:7}" >> "$HISTORY"
  fi
}
trap record_failure EXIT

log "Pull ($BRANCH)"
for repo in "$BACKEND" "$FRONTEND"; do
  git -C "$repo" fetch --quiet origin
  git -C "$repo" checkout --quiet "$BRANCH"
  git -C "$repo" pull --ff-only --quiet origin "$BRANCH"
done
NEW_BACKEND="$(git -C "$BACKEND" rev-parse HEAD)"
NEW_FRONTEND="$(git -C "$FRONTEND" rev-parse HEAD)"
echo "backend  ${PREV_BACKEND:0:7} -> $(git -C "$BACKEND" log -1 --format='%h %s')"
echo "frontend ${PREV_FRONTEND:0:7} -> $(git -C "$FRONTEND" log -1 --format='%h %s')"

log "Backend: install + build into dist.next"
cd "$BACKEND"
# argon2 and sharp ship prebuilt binaries, so no install scripts are needed.
# --include=dev: the TypeScript compiler is a devDependency (and an exported
# NODE_ENV=production would otherwise make npm skip it).
npm ci --ignore-scripts --include=dev --no-audit --no-fund
rm -rf dist.next
npx tsc -p tsconfig.build.json --outDir dist.next --noEmitOnError
node -e "require('argon2'); require('sharp')" || die "native modules do not load"

log "Frontend: install + build (same-origin API: VITE_BACKEND_URL empty)"
cd "$FRONTEND"
npm ci --include=dev --no-audit --no-fund
VITE_BACKEND_URL="" npm run build
[ -f "$FRONTEND/dist/index.html" ] || die "frontend build has no dist/index.html"

log "Database backup before migrating"
"$BACKEND/deploy/backup.sh"

log "Migrate (compiled runner from dist.next)"
cd "$BACKEND"
MIGRATE_ALLOW_PRODUCTION=true MIGRATE_ALLOW_ANY_DB=true node dist.next/db/migrate.js \
  || die "migration failed; the old backend is still running. See deploy/README.md section 7"

log "Switch backend build and restart"
rm -rf dist.prev
if [ -d dist ]; then mv dist dist.prev; fi
mv dist.next dist
sudo /usr/bin/systemctl restart osvs-backend

log "Health check"
healthy=""
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    healthy="yes"
    echo "healthy after ${i}s"
    break
  fi
  sleep 1
done
if [ -z "$healthy" ]; then
  echo "Health check FAILED: $HEALTH_URL" >&2
  # osvs is in the systemd-journal group (see README), so no sudo needed here.
  journalctl -u osvs-backend -n 50 --no-pager >&2 || true
  die "backend unhealthy; frontend NOT published. Roll back with deploy/README.md section 7 (previous backend ${PREV_BACKEND:0:7}, build in dist.prev)"
fi

log "Publish frontend to $WEB_ROOT"
# New hashed assets first (old ones stay for open browser tabs), then the
# app shell, so no index.html ever points at a file that is not there yet.
rsync -a --exclude index.html "$FRONTEND/dist/" "$WEB_ROOT/"
cp "$FRONTEND/dist/index.html" "$WEB_ROOT/.index.html.new"
mv -f "$WEB_ROOT/.index.html.new" "$WEB_ROOT/index.html"
if [ -d "$WEB_ROOT/assets" ]; then
  find "$WEB_ROOT/assets" -type f -mtime +"$KEEP_OLD_ASSETS_DAYS" -delete
fi

echo "$(date -Is) OK backend ${PREV_BACKEND:0:7}->${NEW_BACKEND:0:7} frontend ${PREV_FRONTEND:0:7}->${NEW_FRONTEND:0:7}" >> "$HISTORY"
log "Deployed backend ${NEW_BACKEND:0:7}, frontend ${NEW_FRONTEND:0:7}"
