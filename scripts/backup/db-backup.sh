#!/usr/bin/env bash
# ============================================================================
# Gesher ERP - daily database backup (Nov 25 2026, Ankur Nov 19 call)
#
# Takes one pg_dump of the Supabase database every day and keeps it in 2 places:
#   1. On this server:  $BACKUP_DIR/daily
#   2. Google Drive:    $RCLONE_REMOTE/daily   (via rclone)
#
# Retention (same in both places, Nov 25 2026: last 10 days only):
#   daily   - every run                  kept KEEP_DAILY_DAYS   (default 10)
#   weekly  - extra copy of Sunday's     kept KEEP_WEEKLY_DAYS  (default 0 = off)
#   monthly - extra copy of the 1st's    kept KEEP_MONTHLY_DAYS (default 0 = off)
# A backup is deleted once it is KEEP_DAILY_DAYS old, so with the daily cron
# there are always the last 10 backups.
#
# Read-only for the database: it only runs pg_dump. Nothing in the DB changes.
# Old files are deleted only AFTER today's backup is saved and checked.
#
# Config: read from the app's own .env (DIRECT_URL, SMTP_*, SUPPORT_EMAIL) via
# scripts/lib/app-env.sh. Optional overrides: /etc/gesher/db-backup.env (or
# BACKUP_ENV_FILE=...), see backup.env.example. No secrets in this file.
#
# Exit codes: 0 ok | 1 failed (alert sent) | 2 bad config | 3 already running
# ============================================================================

set -Eeuo pipefail
umask 077

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
# Optional overrides file. Without it everything comes from the app's .env
# (DIRECT_URL, SMTP_*, SUPPORT_EMAIL) - see scripts/lib/app-env.sh.
ENV_FILE="${BACKUP_ENV_FILE:-/etc/gesher/db-backup.env}"
if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
elif [[ -n "${BACKUP_ENV_FILE:-}" ]]; then
  echo "Config file not found or not readable: $ENV_FILE" >&2
  exit 2
fi

# shellcheck source=../lib/app-env.sh
. "$(dirname "${BASH_SOURCE[0]}")/../lib/app-env.sh"
load_app_env
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:Gesher-DB-Backups}"

missing=()
for v in DB_HOST DB_PORT DB_NAME DB_USER PGPASSWORD; do
  [[ -n "${!v:-}" ]] || missing+=("$v")
done
if [[ "${SKIP_DRIVE:-0}" != "1" && -z "${RCLONE_REMOTE:-}" ]]; then
  missing+=("RCLONE_REMOTE")
fi
if (( ${#missing[@]} )); then
  echo "Missing: ${missing[*]} (not in the app .env DIRECT_URL nor in $ENV_FILE)" >&2
  exit 2
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/gesher-db}"
KEEP_DAILY_DAYS="${KEEP_DAILY_DAYS:-10}"
KEEP_WEEKLY_DAYS="${KEEP_WEEKLY_DAYS:-0}"     # 0 = no weekly copies
KEEP_MONTHLY_DAYS="${KEEP_MONTHLY_DAYS:-0}"   # 0 = no monthly copies
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"
MIN_BACKUP_BYTES="${MIN_BACKUP_BYTES:-102400}"   # a dump under 100 KB = something is wrong
SERVER_NAME="${SERVER_NAME:-$(hostname)}"

for n in KEEP_DAILY_DAYS KEEP_WEEKLY_DAYS KEEP_MONTHLY_DAYS MIN_BACKUP_BYTES; do
  if ! [[ "${!n}" =~ ^[0-9]+$ ]]; then
    echo "$n must be a whole number (got '${!n}')" >&2
    exit 2
  fi
done
if (( KEEP_DAILY_DAYS < 1 || MIN_BACKUP_BYTES < 1 )); then
  echo "KEEP_DAILY_DAYS and MIN_BACKUP_BYTES must be >= 1" >&2
  exit 2
fi

export PGPASSWORD PGSSLMODE="${PGSSLMODE:-require}"
unset DATABASE_URL DIRECT_URL   # never needed past this point

mkdir -p "$BACKUP_DIR"/daily "$BACKUP_DIR"/logs
LOG_FILE="$BACKUP_DIR/logs/backup-$(date +%Y-%m).log"
exec > >(tee -a "$LOG_FILE") 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

# ----------------------------------------------------------------------------
# Alerts (all optional): Postmark email on failure + heartbeat ping
# ----------------------------------------------------------------------------
json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\t'/\\t}
  s=${s//$'\r'/}
  s=${s//$'\n'/\\n}
  printf '%s' "$s"
}

send_alert() {
  local subject=$1 body=$2
  if [[ -z "${POSTMARK_SERVER_TOKEN:-}" || -z "${ALERT_EMAIL_FROM:-}" || -z "${ALERT_EMAIL_TO:-}" ]]; then
    log "Alert email not configured (POSTMARK_SERVER_TOKEN / ALERT_EMAIL_FROM / ALERT_EMAIL_TO)"
    return 0
  fi
  curl -fsS -m 20 --retry 2 https://api.postmarkapp.com/email \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
    -d "{\"From\":\"$(json_escape "$ALERT_EMAIL_FROM")\",\"To\":\"$(json_escape "$ALERT_EMAIL_TO")\",\"Subject\":\"$(json_escape "$subject")\",\"TextBody\":\"$(json_escape "$body")\",\"MessageStream\":\"outbound\"}" \
    >/dev/null \
    && log "Alert email sent to $ALERT_EMAIL_TO" \
    || log "WARNING: could not send alert email"
}

heartbeat() {   # $1 = "" (success) or "/fail"
  [[ -n "${HEARTBEAT_URL:-}" ]] || return 0
  curl -fsS -m 10 --retry 3 "${HEARTBEAT_URL%/}$1" >/dev/null || log "WARNING: heartbeat ping failed"
}

STEP="start"
TMP_FILES=()
cleanup() {
  local f
  for f in "${TMP_FILES[@]:-}"; do
    [[ -n "$f" && -e "$f" ]] && rm -f -- "$f"
  done
  return 0
}
on_error() {
  local code=$? line=$1
  trap - ERR
  log "FAILED at step '$STEP' (line $line, exit $code)"
  send_alert "[Gesher DB backup] FAILED on $SERVER_NAME - $STEP" \
"The daily database backup failed.

Server: $SERVER_NAME
Step:   $STEP
Time:   $(date '+%Y-%m-%d %H:%M:%S %Z')
Log:    $LOG_FILE

Last log lines:
$(tail -n 30 "$LOG_FILE" 2>/dev/null)"
  heartbeat "/fail"
  cleanup
  exit 1
}
trap 'on_error $LINENO' ERR
trap cleanup EXIT

# ----------------------------------------------------------------------------
# One run at a time
# ----------------------------------------------------------------------------
exec 9>"$BACKUP_DIR/.lock"
if ! flock -n 9; then
  log "Another backup is already running - exiting"
  exit 3
fi

log "===== Backup started on $SERVER_NAME ====="
SETTINGS_FROM="${APP_ENV_FILE_USED:-no app .env}"
if [[ -r "$ENV_FILE" ]]; then SETTINGS_FROM+=" + $ENV_FILE"; fi
log "Settings from: $SETTINGS_FROM"

# ----------------------------------------------------------------------------
# 1. Dump
# ----------------------------------------------------------------------------
STEP="check tools"
command -v "$PG_DUMP_BIN" >/dev/null
command -v "$PG_RESTORE_BIN" >/dev/null
if [[ "${SKIP_DRIVE:-0}" != "1" ]]; then command -v "$RCLONE_BIN" >/dev/null; fi
log "$("$PG_DUMP_BIN" --version)"

STAMP="$(date +%Y-%m-%d_%H%M)"
NAME="gesher_db_${STAMP}.dump"
FINAL="$BACKUP_DIR/daily/$NAME"
PARTIAL="$BACKUP_DIR/daily/.${NAME}.partial"
TMP_FILES+=("$PARTIAL")

STEP="pg_dump"
log "Dumping $DB_NAME from $DB_HOST:$DB_PORT ..."
# shellcheck disable=SC2086   # PG_DUMP_EXTRA_ARGS is meant to split into words
"$PG_DUMP_BIN" \
  --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" \
  --format=custom --compress=6 \
  --no-owner --no-privileges \
  ${PG_DUMP_EXTRA_ARGS:-} \
  --file="$PARTIAL"

# ----------------------------------------------------------------------------
# 2. Check the dump before keeping it
# ----------------------------------------------------------------------------
STEP="verify dump"
SIZE=$(stat -c %s "$PARTIAL")
if (( SIZE < MIN_BACKUP_BYTES )); then
  log "Dump is only $SIZE bytes (minimum $MIN_BACKUP_BYTES)"
  false
fi
TOC="$("$PG_RESTORE_BIN" --list "$PARTIAL")"
TABLES=$(grep -c " TABLE DATA " <<<"$TOC" || true)
if (( TABLES == 0 )); then
  log "Dump has no table data"
  false
fi
mv -f -- "$PARTIAL" "$FINAL"
( cd "$BACKUP_DIR/daily" && sha256sum "$NAME" > "$NAME.sha256" )
log "Saved $FINAL ($(numfmt --to=iec "$SIZE" 2>/dev/null || echo "$SIZE bytes"), $TABLES tables with data)"

# Sunday -> weekly, 1st of month -> monthly (hard link = no extra disk space)
COPIES=("daily")
if (( KEEP_WEEKLY_DAYS > 0 )) && [[ "$(date +%u)" == "7" ]]; then COPIES+=("weekly"); fi
if (( KEEP_MONTHLY_DAYS > 0 )) && [[ "$(date +%d)" == "01" ]]; then COPIES+=("monthly"); fi
STEP="weekly/monthly copy"
for c in "${COPIES[@]}"; do
  [[ "$c" == "daily" ]] && continue
  mkdir -p "$BACKUP_DIR/$c"
  ln -f "$FINAL" "$BACKUP_DIR/$c/$NAME" 2>/dev/null || cp -p "$FINAL" "$BACKUP_DIR/$c/$NAME"
  cp -p "$FINAL.sha256" "$BACKUP_DIR/$c/$NAME.sha256"
  log "Kept a $c copy"
done

# ----------------------------------------------------------------------------
# 3. Google Drive copy
# ----------------------------------------------------------------------------
if [[ "${SKIP_DRIVE:-0}" != "1" ]]; then
  UPLOAD="$FINAL"
  UPLOAD_NAME="$NAME"

  # Optional: encrypt the Drive copy (the server copy stays plain)
  if [[ -n "${BACKUP_GPG_PASSPHRASE_FILE:-}" ]]; then
    STEP="encrypt for Drive"
    [[ -r "$BACKUP_GPG_PASSPHRASE_FILE" ]]
    UPLOAD="$BACKUP_DIR/daily/.${NAME}.gpg"
    UPLOAD_NAME="${NAME}.gpg"
    TMP_FILES+=("$UPLOAD")
    gpg --batch --yes --quiet --pinentry-mode loopback \
      --passphrase-file "$BACKUP_GPG_PASSPHRASE_FILE" \
      --symmetric --cipher-algo AES256 --output "$UPLOAD" "$FINAL"
    log "Encrypted Drive copy"
  fi

  STEP="upload to Google Drive"
  REMOTE="${RCLONE_REMOTE%/}"
  "$RCLONE_BIN" copyto "$UPLOAD" "$REMOTE/daily/$UPLOAD_NAME" --retries 3 --low-level-retries 10
  log "Uploaded to $REMOTE/daily/$UPLOAD_NAME"
  for c in "${COPIES[@]}"; do
    [[ "$c" == "daily" ]] && continue
    "$RCLONE_BIN" copyto "$REMOTE/daily/$UPLOAD_NAME" "$REMOTE/$c/$UPLOAD_NAME" --retries 3
    log "Drive $c copy done"
  done
  if [[ "$UPLOAD" != "$FINAL" ]]; then rm -f -- "$UPLOAD"; fi
else
  log "SKIP_DRIVE=1 - Google Drive copy skipped"
fi

# ----------------------------------------------------------------------------
# 4. Retention (only reached when today's backup is saved)
# ----------------------------------------------------------------------------
# "N days old" = N days minus 1 hour, so a backup taken at the same time each
# day is removed on day N even if cron ran a few minutes earlier/later.
prune_local() {   # $1 folder, $2 days (0 = folder not used, skip)
  (( $2 > 0 )) || return 0
  [[ -d "$BACKUP_DIR/$1" ]] || return 0
  local deleted
  deleted=$(find "$BACKUP_DIR/$1" -maxdepth 1 -type f -name 'gesher_db_*' -mmin +$(( $2 * 1440 - 60 )) -print -delete | wc -l)
  log "Server $1: removed $deleted old file(s) ($2 days or older)"
}
prune_drive() {   # $1 folder, $2 days (0 = folder not used, skip)
  (( $2 > 0 )) || return 0
  "$RCLONE_BIN" delete "${RCLONE_REMOTE%/}/$1" --min-age "$(( $2 * 24 - 1 ))h" --include 'gesher_db_*' --retries 3     --drive-use-trash="${DRIVE_USE_TRASH:-false}"   # delete for good, not to the Drive trash
  log "Drive $1: removed files $2 days or older"
}

STEP="retention (server)"
prune_local daily   "$KEEP_DAILY_DAYS"
prune_local weekly  "$KEEP_WEEKLY_DAYS"
prune_local monthly "$KEEP_MONTHLY_DAYS"
find "$BACKUP_DIR/logs" -maxdepth 1 -type f -name 'backup-*.log' -mtime +400 -delete

if [[ "${SKIP_DRIVE:-0}" != "1" ]]; then
  STEP="retention (Drive)"
  prune_drive daily   "$KEEP_DAILY_DAYS"
  prune_drive weekly  "$KEEP_WEEKLY_DAYS"
  prune_drive monthly "$KEEP_MONTHLY_DAYS"
fi

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
STEP="done"
date '+%Y-%m-%d %H:%M:%S %Z' > "$BACKUP_DIR/last-success.txt"
heartbeat ""
if [[ "${ALERT_ON_SUCCESS:-0}" == "1" ]]; then
  send_alert "[Gesher DB backup] OK on $SERVER_NAME" "Backup $NAME saved ($TABLES tables). Copies: ${COPIES[*]}."
fi
log "===== Backup finished OK: $NAME ====="
