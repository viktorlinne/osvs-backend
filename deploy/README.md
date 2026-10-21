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
apt update && apt upgrade -y
apt install -y nginx mysql-server certbot git rsync curl build-essential python3 ufw unattended-upgrades
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

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

# Certificate first (nginx default site still serves port 80 at this point)
certbot certonly --webroot -w /var/www/certbot -d osvs.se -d www.osvs.se
#   if the default site does not serve /var/www/certbot, use: certbot certonly --nginx -d ...

cp /opt/osvs/osvs-backend/deploy/nginx/osvs.conf /etc/nginx/sites-available/osvs.conf
ln -s /etc/nginx/sites-available/osvs.conf /etc/nginx/sites-enabled/osvs.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Certbot renews automatically (systemd timer); add
`--deploy-hook "systemctl reload nginx"` on the first run, or put it in
`/etc/letsencrypt/renewal/osvs.se.conf`.

## 5. First deploy and every deploy after (as osvs)

```bash
/opt/osvs/osvs-backend/deploy/deploy.sh
```

It pulls both repos, builds, backs up the database, runs migrations with the
compiled runner (`npm run migrate:prod`), publishes the frontend to
`/var/www/osvs`, restarts the backend and waits for `/api/health`.

On a fresh database, the first deploy creates the schema (migrations 001–013).
Then load data: either import a dump of an existing database, or run the
Access import (`npm run migrate:legacy -- --apply …`, see
`scripts/migration/MIGRATION_PLAN.md`) — the latter needs the extract and the
old-site files on the server and `ts-node` (dev dependencies are installed by
`npm ci`).

## 6. Backups (as osvs)

```bash
crontab -e
15 3 * * * /opt/osvs/osvs-backend/deploy/backup.sh >> /var/backups/osvs/backup.log 2>&1
```

Copy `/var/backups/osvs` off the machine (rsync/rclone). Restore:
`gunzip -c <file>.sql.gz | mysql osvs_prod`.

## Checks after go-live

- `curl -fsS https://osvs.se/api/health`
- `journalctl -u osvs-backend -f` while logging in and sending a test mailing
- `MAIL_DEV_ALLOWLIST` is ignored only because `NODE_ENV=production`; confirm a
  group mailing reaches a non-allowlisted test address.
