#!/usr/bin/env bash
# ============================================================================
# Gesher ERP - server health check (Nov 25 2026, Ankur Nov 19 call)
#
# Run by cron every 5 minutes on the app server. Checks:
#   app     - APP_HEALTH_URL answers 200 (app up + database answering)
#   disk    - every path in DISK_PATHS below DISK_WARN_PCT % used
#   memory  - RAM used below MEM_WARN_PCT %
#   cpu     - 5-minute load average below CPU_WARN_PCT % of the CPU cores
#   backup  - last good DB backup newer than BACKUP_MAX_AGE_HOURS
#
# Sends ONE email when a problem starts, a reminder every ALERT_REPEAT_HOURS
# while it lasts. No spam every 5 min. (Nov 27 2026: no email on recovery -
# it is only logged; a problem mail still lists anything recovered meanwhile.)
#
# Read-only: it changes nothing on the server except its own state files.
# Config: read from the app's own .env (SMTP_*, SUPPORT_EMAIL,
# NEXT_PUBLIC_APP_URL) via scripts/lib/app-env.sh. Optional overrides:
# /etc/gesher/monitor.env (or MONITOR_ENV_FILE=...), see monitor.env.example.
# ============================================================================

set -uo pipefail
umask 077

# Optional overrides file. Without it the alert settings and app URL come from
# the app's .env (SMTP_*, SUPPORT_EMAIL, NEXT_PUBLIC_APP_URL).
ENV_FILE="${MONITOR_ENV_FILE:-/etc/gesher/monitor.env}"
if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
elif [[ -n "${MONITOR_ENV_FILE:-}" ]]; then
  echo "Config file not found or not readable: $ENV_FILE" >&2
  exit 2
fi

# shellcheck source=../lib/app-env.sh
. "$(dirname "${BASH_SOURCE[0]}")/../lib/app-env.sh"
load_app_env
unset PGPASSWORD DATABASE_URL DIRECT_URL   # the monitor never touches the DB directly

if [[ -z "${APP_HEALTH_URL:-}" ]]; then
  if [[ -n "${APP_PUBLIC_URL:-}" ]]; then
    APP_HEALTH_URL="$APP_PUBLIC_URL/api/health"
  else
    APP_HEALTH_URL="http://localhost:3000/api/health"
  fi
fi
DISK_PATHS="${DISK_PATHS:-/}"
DISK_WARN_PCT="${DISK_WARN_PCT:-80}"
MEM_WARN_PCT="${MEM_WARN_PCT:-90}"
CPU_WARN_PCT="${CPU_WARN_PCT:-90}"
BACKUP_STATUS_FILE="${BACKUP_STATUS_FILE:-/var/backups/gesher-db/last-success.txt}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"
ALERT_REPEAT_HOURS="${ALERT_REPEAT_HOURS:-6}"
STATE_DIR="${STATE_DIR:-/var/lib/gesher-monitor}"
SERVER_NAME="${SERVER_NAME:-$(hostname)}"

for n in DISK_WARN_PCT MEM_WARN_PCT CPU_WARN_PCT BACKUP_MAX_AGE_HOURS ALERT_REPEAT_HOURS; do
  if ! [[ "${!n}" =~ ^[0-9]+$ ]] || (( ${!n} < 1 )); then
    echo "$n must be a whole number >= 1 (got '${!n}')" >&2
    exit 2
  fi
done

mkdir -p "$STATE_DIR"
LOG_FILE="$STATE_DIR/monitor-$(date +%Y-%m).log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*" >> "$LOG_FILE"; }

exec 9>"$STATE_DIR/.lock"
flock -n 9 || exit 3

NOW=$(date +%s)

# ----------------------------------------------------------------------------
# Alerts
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
    log "Alert email not configured - would have sent: $subject"
    return 0
  fi
  if curl -fsS -m 20 --retry 2 https://api.postmarkapp.com/email \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
    -d "{\"From\":\"$(json_escape "$ALERT_EMAIL_FROM")\",\"To\":\"$(json_escape "$ALERT_EMAIL_TO")\",\"Subject\":\"$(json_escape "$subject")\",\"TextBody\":\"$(json_escape "$body")\",\"MessageStream\":\"outbound\"}" \
    >/dev/null; then
    log "Alert sent: $subject"
  else
    log "WARNING: could not send alert: $subject"
  fi
}

# ----------------------------------------------------------------------------
# Checks: each one calls report <name> ok|problem "<message>"
# ----------------------------------------------------------------------------
NEW_PROBLEMS=()
REMINDERS=()
RECOVERED=()
SUMMARY=()

report() {   # $1 check name, $2 ok|problem, $3 message
  local name=$1 state=$2 msg=$3
  local file="$STATE_DIR/problem-${name//[^a-zA-Z0-9_-]/_}"
  SUMMARY+=("$name: $state - $msg")

  if [[ "$state" == "ok" ]]; then
    if [[ -f "$file" ]]; then
      local since
      since=$(head -n1 "$file" 2>/dev/null || echo "$NOW")
      RECOVERED+=("$name: $msg (was down $(( (NOW - since) / 60 )) min)")
      rm -f -- "$file"
      log "RECOVERED $name - $msg"
    fi
    return
  fi

  if [[ ! -f "$file" ]]; then
    printf '%s\n%s\n' "$NOW" "$NOW" > "$file"
    NEW_PROBLEMS+=("$name: $msg")
    log "PROBLEM $name - $msg"
  else
    local since last
    since=$(sed -n 1p "$file")
    last=$(sed -n 2p "$file")
    if (( NOW - last >= ALERT_REPEAT_HOURS * 3600 )); then
      printf '%s\n%s\n' "$since" "$NOW" > "$file"
      REMINDERS+=("$name: $msg (since $(date -d "@$since" '+%Y-%m-%d %H:%M %Z'))")
      log "STILL $name - $msg"
    fi
  fi
}

# --- app + database (via /api/health) ---
check_app() {
  local code body tmp
  tmp=$(mktemp)
  for attempt in 1 2; do
    code=$(curl -s -o "$tmp" -w '%{http_code}' -m 15 "$APP_HEALTH_URL" 2>/dev/null)
    [[ "$code" == "200" ]] && break
    [[ $attempt == 1 ]] && sleep 10   # one retry so a short blip does not alert
  done
  body=$(head -c 300 "$tmp" 2>/dev/null); rm -f -- "$tmp"
  if [[ "$code" == "200" ]]; then
    report app ok "$APP_HEALTH_URL answered 200"
  elif [[ "$code" == "503" ]]; then
    report app problem "app is up but the DATABASE is not answering (503). $body"
  elif [[ "$code" == "000" || -z "$code" ]]; then
    report app problem "app is DOWN - no answer from $APP_HEALTH_URL"
  else
    report app problem "$APP_HEALTH_URL answered HTTP $code"
  fi
}

check_disk() {
  local p used
  for p in $DISK_PATHS; do
    # the "Capacity" column is the one ending in % (works even if the device name has spaces)
    used=$(df -P "$p" 2>/dev/null | awk 'NR==2 { for (i = NF; i > 0; i--) if ($i ~ /^[0-9]+%$/) { sub("%", "", $i); print $i; exit } }')
    if ! [[ "$used" =~ ^[0-9]+$ ]]; then
      report "disk$p" problem "cannot read disk usage of $p"
    elif (( used >= DISK_WARN_PCT )); then
      report "disk$p" problem "disk $p is ${used}% full (limit ${DISK_WARN_PCT}%)"
    else
      report "disk$p" ok "disk $p ${used}% used"
    fi
  done
}

check_memory() {
  local used
  # MemAvailable (Linux 3.14+); older kernels: MemFree + Buffers + Cached
  used=$(awk '/^MemTotal:/ { t=$2 } /^MemAvailable:/ { a=$2; have=1 } /^(MemFree|Buffers|Cached):/ { f+=$2 }
              END { if (!have) a=f; if (t > 0) printf "%d", (t - a) * 100 / t }' /proc/meminfo 2>/dev/null)
  if ! [[ "$used" =~ ^[0-9]+$ ]]; then
    report memory problem "cannot read /proc/meminfo"
  elif (( used >= MEM_WARN_PCT )); then
    report memory problem "RAM is ${used}% used (limit ${MEM_WARN_PCT}%). Top: $(ps -eo comm,%mem --sort=-%mem | sed -n 2,4p | tr -s ' ' | paste -sd ',' -)"
  else
    report memory ok "RAM ${used}% used"
  fi
}

check_cpu() {
  local cores pct
  cores=$(nproc 2>/dev/null || echo 1)
  pct=$(awk -v c="$cores" '{ printf "%d", $2 * 100 / c }' /proc/loadavg 2>/dev/null)
  if [[ -z "$pct" ]]; then
    report cpu problem "cannot read /proc/loadavg"
  elif (( pct >= CPU_WARN_PCT )); then
    report cpu problem "CPU load is ${pct}% of $cores core(s) over 5 min (limit ${CPU_WARN_PCT}%). Top: $(ps -eo comm,%cpu --sort=-%cpu | sed -n 2,4p | tr -s ' ' | paste -sd ',' -)"
  else
    report cpu ok "CPU load ${pct}% of $cores core(s)"
  fi
}

check_backup() {
  [[ "${SKIP_BACKUP_CHECK:-0}" == "1" ]] && return
  if [[ ! -f "$BACKUP_STATUS_FILE" ]]; then
    report backup problem "no successful DB backup yet ($BACKUP_STATUS_FILE missing)"
    return
  fi
  local age_h
  age_h=$(( (NOW - $(stat -c %Y "$BACKUP_STATUS_FILE")) / 3600 ))
  if (( age_h >= BACKUP_MAX_AGE_HOURS )); then
    report backup problem "last good DB backup was ${age_h} hours ago (limit ${BACKUP_MAX_AGE_HOURS}h): $(cat "$BACKUP_STATUS_FILE")"
  else
    report backup ok "last good DB backup ${age_h}h ago"
  fi
}

check_app
check_disk
check_memory
check_cpu
check_backup

# ----------------------------------------------------------------------------
# One email per run, only when something changed
# ----------------------------------------------------------------------------
# if (( ${#NEW_PROBLEMS[@]} + ${#REMINDERS[@]} + ${#RECOVERED[@]} )); then
# Nov 27 2026: email only for problems (new or still open). A recovery alone
# sends nothing - it is written to the monitor log only.
if (( ${#NEW_PROBLEMS[@]} + ${#REMINDERS[@]} )); then
  body="Server: $SERVER_NAME
Time:   $(date '+%Y-%m-%d %H:%M:%S %Z')
"
  if (( ${#NEW_PROBLEMS[@]} )); then
    body+="
NEW PROBLEM:
$(printf ' - %s\n' "${NEW_PROBLEMS[@]}")
"
  fi
  if (( ${#REMINDERS[@]} )); then
    body+="
STILL A PROBLEM:
$(printf ' - %s\n' "${REMINDERS[@]}")
"
  fi
  if (( ${#RECOVERED[@]} )); then
    body+="
RECOVERED:
$(printf ' - %s\n' "${RECOVERED[@]}")
"
  fi
  body+="
All checks:
$(printf ' - %s\n' "${SUMMARY[@]}")
"
  if (( ${#NEW_PROBLEMS[@]} + ${#REMINDERS[@]} )); then
    subject="[Gesher server] PROBLEM on $SERVER_NAME - $(printf '%s' "${NEW_PROBLEMS[0]:-${REMINDERS[0]}}" | cut -d: -f1)"
  else
    subject="[Gesher server] RECOVERED on $SERVER_NAME"
  fi
  send_alert "$subject" "$body"
fi

if [[ -n "${HEARTBEAT_URL:-}" ]]; then
  curl -fsS -m 10 --retry 2 "$HEARTBEAT_URL" >/dev/null 2>&1 || log "WARNING: heartbeat ping failed"
fi

find "$STATE_DIR" -maxdepth 1 -type f -name 'monitor-*.log' -mtime +90 -delete 2>/dev/null
exit 0
