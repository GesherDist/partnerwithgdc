# Gesher ERP: daily database backup

Approved by Ankur on the Nov 19 2026 call. Every night one `pg_dump` of the Supabase database is saved in 2 places:

| Where | Folder | Kept |
|---|---|---|
| This server | `/var/backups/gesher-db/daily` | last 10 days |
| Google Drive | `Gesher-DB-Backups/daily` | last 10 days |

A backup is deleted automatically, in both places, once it is 10 days old. With the daily cron, there are always the last 10 backups. To keep long-term copies as well, set `KEEP_WEEKLY_DAYS` and `KEEP_MONTHLY_DAYS` (off by default). See `backup.env.example`.

The script only reads from the database. Old backups are deleted only after the day's backup has been saved and checked. If any step fails, it sends an alert email and a heartbeat "fail" ping.

Files in this folder:
- `db-backup.sh`: the backup script.
- `backup.env.example`: the config template. The real file lives at `/etc/gesher/db-backup.env` on the server and is never committed.

---

## Setup on the server (Ubuntu, one time)

### 1. Tools

`pg_dump` must be the same major version as the Supabase database or newer. Check the version under Supabase → Project Settings → Infrastructure.

```bash
sudo apt update
sudo apt install -y curl gnupg ca-certificates util-linux
# PostgreSQL client from the official repo (replace 17 with the DB version)
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update && sudo apt install -y postgresql-client-17
# rclone
sudo -v ; curl https://rclone.org/install.sh | sudo bash
```

### 2. Config

**Usually nothing to do.** The script reads everything it needs from the app's own `.env` in the repo root, so there is one place for secrets:

| From the app `.env` | Used for |
|---|---|
| `DIRECT_URL` | DB host, port, user, password. A `localhost` host means no SSL. |
| `SMTP_USER` | Postmark server token, when `SMTP_HOST` is Postmark |
| `SMTP_FROM_EMAIL` / `SUPPORT_EMAIL` | Alert From / To |

`DIRECT_URL` must use port **5432** (Supavisor session mode), as it does on live. Port 6543, the transaction mode, does not work for `pg_dump`.

To override something, for example to send alerts to more people or to point at a `.env` outside the repo, copy the template and uncomment only those lines:

```bash
sudo mkdir -p /etc/gesher
sudo cp scripts/backup/backup.env.example /etc/gesher/db-backup.env
sudo chmod 600 /etc/gesher/db-backup.env
sudo nano /etc/gesher/db-backup.env
```

### 3. Google Drive (rclone)

This is done once, by someone who can log in to the Google account where the backups should go (Ankur's Drive).

```bash
sudo rclone config
#   n) New remote  -> name: gdrive
#   Storage: drive  (Google Drive)
#   client_id / client_secret: leave empty (or use your own Google OAuth app)
#   scope: 1 (full access)  - or 3 (drive.file: only files rclone creates)
#   Use auto config? -> n   (server has no browser)
#   On your laptop run the "rclone authorize ..." command it prints, log in
#   with the Google account, paste the token back.
sudo rclone mkdir gdrive:Gesher-DB-Backups
sudo rclone lsd gdrive:        # should list Gesher-DB-Backups
```

`RCLONE_REMOTE=gdrive:Gesher-DB-Backups` in the config must match the remote name and folder.

Notes on Google Drive:
- Old Drive backups are deleted for good. They do not go to the Drive trash, so they do not keep using Drive space. To send them to the trash instead (where they are kept for 30 days), add `DRIVE_USE_TRASH=true` to `/etc/gesher/db-backup.env`.
- To encrypt the Drive copy, set `BACKUP_GPG_PASSPHRASE_FILE`. Store the passphrase somewhere safe too: without it, the Drive copy cannot be restored.

### 4. Install the script and run it once by hand

```bash
sudo install -d /opt/gesher
sudo install -m 750 scripts/backup/db-backup.sh /opt/gesher/db-backup.sh
sudo /opt/gesher/db-backup.sh
```

You should see `Backup finished OK`. Then check both places:

```bash
ls -lh /var/backups/gesher-db/daily
sudo rclone ls gdrive:Gesher-DB-Backups/daily
```

The first run may stop with a permission error on a Supabase-managed schema. In that case, add `PG_DUMP_EXTRA_ARGS="--exclude-schema=<that schema>"` to the config and run it again.

### 5. Daily cron

Cron uses the server's time zone. Check it with `timedatectl`. AWS servers are usually on UTC.
Ubuntu's cron ignores `CRON_TZ`, so set the time in the server's own zone.

On a UTC server, `0 6` runs at 06:00 UTC, which is 1:00 AM New York time in winter and 2:00 AM in summer (11:30 AM in India):

```bash
sudo crontab -e
```
```
0 6 * * * bash /path/to/partnerwithgdc/scripts/backup/db-backup.sh >/dev/null 2>&1
```

The script writes its own log to `/var/backups/gesher-db/logs/backup-YYYY-MM.log`.

### 6. Alerts

- **Failure email:** set `POSTMARK_SERVER_TOKEN`, `ALERT_EMAIL_FROM` (a verified Postmark sender) and `ALERT_EMAIL_TO`.
- **Heartbeat:** this catches the case where cron never ran at all.
  1. Create a free check on healthchecks.io (or a Better Stack or UptimeRobot heartbeat) with period 1 day and grace 2 hours.
  2. Put its URL in `HEARTBEAT_URL`.

  The script pings it on success and pings `<url>/fail` on failure.

---

## Check that it keeps working

```bash
cat /var/backups/gesher-db/last-success.txt     # time of the last good backup
tail -n 30 /var/backups/gesher-db/logs/backup-$(date +%Y-%m).log
```

Once a month, restore the latest backup into a test database (next section) to be sure the backups are usable.

---

## Restore

> Never restore into the live database without agreeing with Ankur first. A restore overwrites data.

The safe way is to restore into a new, empty Supabase project (or a local Postgres), check the data there, and only then decide.

```bash
# 1. Pick a backup (server copy, or download one from Drive)
ls /var/backups/gesher-db/daily
# from Drive:  rclone copy gdrive:Gesher-DB-Backups/daily/<file> /tmp/restore/
# if encrypted: gpg --decrypt --output /tmp/restore/x.dump /tmp/restore/x.dump.gpg

# 2. Check the file is not damaged
cd /var/backups/gesher-db/daily && sha256sum -c <file>.sha256

# 3. Restore into the TEST database (session pooler of the test project)
PGPASSWORD='<test db password>' pg_restore \
  --host=<test-host> --port=5432 --username=<test-user> --dbname=postgres \
  --no-owner --no-privileges --clean --if-exists \
  /var/backups/gesher-db/daily/<file>
```

Errors about Supabase's own schemas (`auth`, `storage`, extensions) are normal when restoring into a new Supabase project. Check the app tables (`customers`, `sales_orders`, `products`, ...) for the data. To restore only the app data, add `--schema=public`.
