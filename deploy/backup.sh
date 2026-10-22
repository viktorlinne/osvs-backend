#!/usr/bin/env bash
# Dump the OSVS database to a gzip file and keep the last $KEEP_DAYS days.
# Media (photos, post images, PDFs) is stored in the database, so this dump
# plus the backend .env is everything needed to restore.
#
# Credentials come from ~/.my.cnf of the user running it (never the command
# line), e.g. for user osvs:
#   [client]
#   user=osvs
#   password=<db password>
# Nightly via cron (crontab -e as osvs):
#   15 3 * * * /opt/osvs/osvs-backend/deploy/backup.sh >> /var/backups/osvs/backup.log 2>&1
# Copy BACKUP_DIR off the machine as well (rsync/rclone to another host).
#
# The dump contains personal data (personnummer, addresses, password hashes):
# files are created mode 600 in a mode 700 directory. Restore: see
# deploy/README.md section 6 (tested: restore into a scratch database, compare
# CHECKSUM TABLE of every table).

set -euo pipefail
umask 077

DB_NAME="${DB_NAME:-osvs_prod}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/osvs}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
file="$BACKUP_DIR/${DB_NAME}-$(date +%Y%m%d-%H%M%S).sql.gz"
trap 'rm -f "$file.tmp"' EXIT

# --no-tablespaces: the app user has no PROCESS privilege (MySQL >= 8.0.21
# would otherwise print an "Access denied ... dump tablespaces" error nightly).
mysqldump --single-transaction --routines --triggers --hex-blob \
  --no-tablespaces --default-character-set=utf8mb4 "$DB_NAME" \
  | gzip -9 > "$file.tmp"

# A dump that stopped early still gunzips; mysqldump writes this footer last.
gzip -t "$file.tmp"
if ! gunzip -c "$file.tmp" | tail -n 1 | grep -q '^-- Dump completed'; then
  echo "backup FAILED: $file.tmp has no 'Dump completed' footer" >&2
  exit 1
fi

mv "$file.tmp" "$file"
echo "backup written: $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -mtime +"$KEEP_DAYS" -delete
