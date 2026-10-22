# Deploying OSVS on Ubuntu 24.04

Frontend (static SPA) and backend API on one origin behind nginx, MySQL 8.0 on
the same machine, backend as one systemd service. Background and sizing:
`C:\OSVS\UBUNTU.md`.

Files in this folder:

| File | Goes to |
|---|---|
| `nginx/osvs.conf` | `/etc/nginx/sites-available/osvs.conf` (+ symlink in `sites-enabled`) |
| `systemd/osvs-backend.service` | `/etc/systemd/system/osvs-backend.service` |
| `env.production.example` | template for `/opt/osvs/osvs-backend/.env` |
| `deploy.sh` | run for every deploy (as `osvs`) |
| `backup.sh` | nightly cron + called by `deploy.sh` before migrating |

Replace `osvs.se` with the host you deploy to. **Test on a subdomain first**
(e.g. `ny.osvs.se`): the certificate needs DNS to point at the server, and the
real `osvs.se` keeps pointing at the old site until cutover (2026-12-31).

## 1. Packages (as root)

```bash
timedatectl set-timezone Europe/Stockholm   # before MySQL: Node and MySQL must share one zone
apt update && apt upgrade -y
apt install -y nginx mysql-server certbot git rsync curl ufw unattended-upgrades
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

Time zone: the backend writes token expiry and similar times from Node and
compares them with MySQL `NOW()`, and event times are Stockholm wall-clock
times compared with `NOW()`. Both processes follow the system zone, so set it
once (above; if MySQL was already running, `systemctl restart mysql`). The
backend logs a warning at startup when the two clocks disagree.

`build-essential`/`python3` are not needed: `argon2` and `sharp` ship prebuilt
Linux binaries, and `deploy.sh` installs with `npm ci --ignore-scripts`.

Check that outbound SMTP works (some providers block it):
`nc -vz smtp.websupport.se 465`

## 2. MySQL (as root)

`/etc/mysql/mysql.conf.d/zz-osvs.cnf`:

```ini
[mysqld]
character-set-server = utf8mb4
collation-server = utf8mb4_general_ci
bind-address = 127.0.0.1
```

```bash
systemctl restart mysql
mysql -e "CREATE DATABASE osvs_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
          CREATE USER 'osvs'@'localhost' IDENTIFIED BY '<db password>';
          GRANT ALL PRIVILEGES ON osvs_prod.* TO 'osvs'@'localhost';"
```

## 3. App user, code, configuration (as root, then osvs)

```bash
useradd --system --create-home --shell /bin/bash osvs
usermod -aG systemd-journal osvs
mkdir -p /opt/osvs /var/www/osvs /var/www/certbot /var/backups/osvs
chown -R osvs:osvs /opt/osvs /var/www/osvs /var/backups/osvs
echo 'osvs ALL=(root) NOPASSWD: /usr/bin/systemctl restart osvs-backend' > /etc/sudoers.d/osvs-deploy
chmod 440 /etc/sudoers.d/osvs-deploy

sudo -iu osvs
git clone https://github.com/viktorlinne/osvs-backend.git  /opt/osvs/osvs-backend
git clone https://github.com/viktorlinne/osvs-frontend.git /opt/osvs/osvs-frontend
cp /opt/osvs/osvs-backend/deploy/env.production.example /opt/osvs/osvs-backend/.env
chmod 600 /opt/osvs/osvs-backend/.env     # then fill in every <...>
printf '[client]\nuser=osvs\npassword=<db password>\n' > ~/.my.cnf && chmod 600 ~/.my.cnf
chmod +x /opt/osvs/osvs-backend/deploy/*.sh
```

## 4. Service and web server (as root)

```bash
cp /opt/osvs/osvs-backend/deploy/systemd/osvs-backend.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable osvs-backend

# Certificate first. A temporary port-80 site serves the ACME challenge from
# /var/www/certbot, the same directory osvs.conf uses, so renewals keep working.
cat > /etc/nginx/sites-available/acme-bootstrap <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
}
NGINX
ln -s /etc/nginx/sites-available/acme-bootstrap /etc/nginx/sites-enabled/acme-bootstrap
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/certbot -d osvs.se -d www.osvs.se \
  --deploy-hook "systemctl reload nginx"
rm /etc/nginx/sites-enabled/acme-bootstrap

cp /opt/osvs/osvs-backend/deploy/nginx/osvs.conf /etc/nginx/sites-available/osvs.conf
ln -s /etc/nginx/sites-available/osvs.conf /etc/nginx/sites-enabled/osvs.conf
nginx -t && systemctl reload nginx
certbot renew --dry-run
```

`osvs.conf` sets its own TLS options; it does not include
`/etc/letsencrypt/options-ssl-nginx.conf` (only certbot's nginx plugin creates
that file). Certbot renews automatically (systemd timer) and reloads nginx via
the deploy hook saved in `/etc/letsencrypt/renewal/osvs.se.conf`.

## 5. First deploy and every deploy after (as osvs)

```bash
/opt/osvs/osvs-backend/deploy/deploy.sh
```

It refuses to run with local changes in either repo or while another deploy
runs, then: pulls both repos, installs and builds (backend into `dist.next`
while the service keeps running `dist/`), backs up the database, runs the
migrations with the new compiled runner, switches `dist.next` to `dist`
(the previous build is kept as `dist.prev`), restarts the backend, waits for
`/api/health`, and only then publishes the frontend to `/var/www/osvs` (new
hashed assets first, `index.html` last; assets of older deploys are removed
after 14 days). Every run is logged to `/opt/osvs/deploy-history.log`.

Migrations run while the old backend still serves requests: a migration must
work with the previous code too (add columns/tables; rename or drop only in a
later release).

The database must exist before the first deploy (section 2): the pre-migration
backup dumps it. On a fresh database, the first deploy creates the schema (all
files in `src/db/migrations/`).
Then load data: either import a dump of an existing database, or run the
Access import (`npm run migrate:legacy -- --apply …`, see
`scripts/migration/MIGRATION_PLAN.md`) — the latter needs the extract and the
old-site files on the server and `ts-node` (dev dependencies are installed by
`npm ci`). There is no demo seed: `src/db/seed/seed.sql` only holds lookup
rows (roles, achievements, officials, allergies, lodges). On the server, add
`--seed-lookups` to the apply run to upsert them (same rows as `npm run seed`,
which in production would also need `SEED_ALLOW_PRODUCTION=true`); the apply
itself needs `MIGRATE_ALLOW_PRODUCTION=true` and a fresh backup. Staging
rehearsals use the same commands. The extract contains personal data: copy it
to the server outside the repo and delete it after the import.

The backend refuses to start in production with values left from
`env.production.example` (`<...>` placeholders, a JWT secret shorter than 32
characters, an empty `DB_PASS`, a non-https `FRONTEND_URL`); the reason is in
`journalctl -u osvs-backend`.

## 6. Backups and restore (as osvs)

```bash
crontab -e
15 3 * * * /opt/osvs/osvs-backend/deploy/backup.sh >> /var/backups/osvs/backup.log 2>&1
```

`backup.sh` writes `/var/backups/osvs/osvs_prod-<date>.sql.gz` (mode 600,
directory mode 700: the dump holds personnummer, addresses and password
hashes), checks that the dump is complete, and keeps 14 days. `deploy.sh`
also takes one before every migration. With today's data a dump is about
35 MB (mostly photos, which do not compress).

Copy `/var/backups/osvs` off the machine (rsync/rclone to storage you
control; the dumps are not encrypted, so encrypt them first if the target is
shared, e.g. `gpg --symmetric` or an encrypted rclone remote).

Restore into a scratch database first and compare, then into production:

```bash
f=/var/backups/osvs/osvs_prod-YYYYMMDD-HHMMSS.sql.gz
mysql -e "CREATE DATABASE osvs_restore_check CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"
gunzip -c "$f" | mysql osvs_restore_check
mysql -N -e "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='osvs_restore_check' ORDER BY 1"
# Real restore (backend stopped so nothing writes meanwhile):
sudo systemctl stop osvs-backend     # needs root; the osvs sudo rule only allows restart
gunzip -c "$f" | mysql osvs_prod
sudo systemctl start osvs-backend
mysql -e "DROP DATABASE osvs_restore_check"
```

The dump drops and recreates every table, including `_migrations`, so the
migration state matches the restored data. (`osvs` needs CREATE/DROP on
`osvs_restore_check` for the check, or run it as root.) Practise a restore
at least once before go-live and after major schema changes.

## 7. Rollback

If `deploy.sh` stops **before** "Switch backend build and restart" (build,
backup or migration failed), the running backend and the published frontend
are unchanged: fix the cause and deploy again. Two caveats:

- `npm ci` has already replaced `node_modules`. The running process keeps the
  modules it loaded, but if it restarts before the next successful deploy it
  starts the old `dist/` with the new modules. If that fails, finish the
  rollback below.
- A failed migration can be half-applied (MySQL DDL is not transactional; the
  log names the failing file and statement). Either fix the migration and
  deploy again, or restore the pre-deploy backup (newest file in
  `/var/backups/osvs`, section 6).

If the health check fails **after** the switch, the frontend was not
published. Roll the backend back to the previous build (the previous commit
is in the error message and in `/opt/osvs/deploy-history.log`):

```bash
cd /opt/osvs/osvs-backend
git checkout <previous commit>
rm -rf dist && mv dist.prev dist
npm ci --ignore-scripts --include=dev --no-audit --no-fund
sudo /usr/bin/systemctl restart osvs-backend
curl -fsS http://127.0.0.1:4000/api/health
```

The database keeps the new migrations (they must be compatible with the
previous code, see section 5); restore the pre-deploy backup only if they are
not. The next `deploy.sh` checks out `main` again.

## Checks after go-live

- `curl -fsS https://osvs.se/api/health`
- `journalctl -u osvs-backend -f` while logging in and sending a test mailing;
  no "config_warning" and no "Node and MySQL disagree about local time"
  lines at startup
- `MAIL_DEV_ALLOWLIST` is ignored only because `NODE_ENV=production`; confirm a
  group mailing reaches a non-allowlisted test address.
- `sudo systemctl restart osvs-backend` logs "Shutting down" and
  "Shutdown complete" (graceful stop, no SIGKILL)
- the first nightly backup exists, is mode 600, and restores (section 6)
- the Content-Security-Policy is shipped as `Content-Security-Policy-Report-Only`
  (`nginx/osvs.conf`, `/assets/` and `= /index.html`). Click through the site
  (login, map, profile picture upload, events, mailings) with the browser
  console open; when it shows no CSP reports, rename the header to
  `Content-Security-Policy` in both places, `sudo nginx -t`, reload.
