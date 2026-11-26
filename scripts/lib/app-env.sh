#!/usr/bin/env bash
# ============================================================================
# Shared helper for scripts/backup and scripts/monitoring (Nov 25 2026)
#
# Reads the values the scripts need straight from the app's own .env, so there
# is one place for secrets. The .env is only READ (never sourced/executed), one
# key at a time, so special characters in other values cannot break anything.
#
# Which .env: APP_ENV_FILE if set, else the first of these in the repo root
# that has DIRECT_URL: .env.production.local, .env.local, .env.production, .env
# ============================================================================

# Repo root = two levels up from this file (scripts/lib -> repo)
APP_REPO_DIR="${APP_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

find_app_env_file() {
  if [[ -n "${APP_ENV_FILE:-}" ]]; then
    [[ -r "$APP_ENV_FILE" ]] && { printf '%s' "$APP_ENV_FILE"; return 0; }
    echo "APP_ENV_FILE not readable: $APP_ENV_FILE" >&2
    return 1
  fi
  local f
  for f in .env.production.local .env.local .env.production .env; do
    if [[ -r "$APP_REPO_DIR/$f" ]] && grep -qE '^[[:space:]]*(export[[:space:]]+)?DIRECT_URL=' "$APP_REPO_DIR/$f"; then
      printf '%s' "$APP_REPO_DIR/$f"
      return 0
    fi
  done
  return 1
}

# app_env_value KEY FILE -> prints the value (last occurrence, quotes removed)
app_env_value() {
  local key=$1 file=$2 line val
  line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | tail -n 1) || true
  [[ -n "$line" ]] || return 0
  val=${line#*=}
  val=${val%$'\r'}
  # surrounding quotes
  if [[ "$val" =~ ^\"(.*)\"[[:space:]]*$ ]]; then
    val=${BASH_REMATCH[1]}
  elif [[ "$val" =~ ^\'(.*)\'[[:space:]]*$ ]]; then
    val=${BASH_REMATCH[1]}
  else
    val=${val%%[[:space:]]#*}       # unquoted: drop " # comment"
    val=${val%"${val##*[![:space:]]}"}
  fi
  printf '%s' "$val"
}

urldecode() { local s=${1//+/ }; printf '%b' "${s//%/\\x}"; }

# Fill DB_* / PGPASSWORD / PGSSLMODE from DIRECT_URL, alerts from SMTP_* /
# ALERT_EMAIL_TO (else SUPPORT_EMAIL). Values already set (from /etc/gesher/*.env) always win.
load_app_env() {
  local file
  if ! file=$(find_app_env_file); then
    echo "App .env not found (looked in $APP_REPO_DIR; set APP_ENV_FILE)" >&2
    return 0
  fi
  APP_ENV_FILE_USED=$file

  local url
  url=$(app_env_value DIRECT_URL "$file")
  if [[ -n "$url" ]]; then
    # postgresql://user:password@host:port/db?params
    local rest creds hostpart hostport db
    rest=${url#*://}
    creds=${rest%@*}
    hostpart=${rest##*@}
    hostport=${hostpart%%/*}
    db=${hostpart#*/}; db=${db%%\?*}
    [[ "$hostpart" == */* ]] || db=postgres
    : "${DB_USER:=$(urldecode "${creds%%:*}")}"
    if [[ "$creds" == *:* ]]; then : "${PGPASSWORD:=$(urldecode "${creds#*:}")}"; fi
    if [[ "$hostport" == *:* ]]; then
      : "${DB_HOST:=${hostport%:*}}"
      : "${DB_PORT:=${hostport##*:}}"
    else
      : "${DB_HOST:=$hostport}"
      : "${DB_PORT:=5432}"
    fi
    : "${DB_NAME:=${db:-postgres}}"
  fi
  # Local pooler/DB has no SSL; anything remote must use SSL
  if [[ -z "${PGSSLMODE:-}" ]]; then
    case "${DB_HOST:-}" in
      localhost|127.0.0.1|::1) PGSSLMODE=disable ;;
      *) PGSSLMODE=require ;;
    esac
  fi

  # Postmark: POSTMARK_SERVER_TOKEN, else the SMTP user when SMTP is Postmark
  # (Postmark's SMTP username IS the server token)
  if [[ -z "${POSTMARK_SERVER_TOKEN:-}" ]]; then
    POSTMARK_SERVER_TOKEN=$(app_env_value POSTMARK_SERVER_TOKEN "$file")
    if [[ -z "$POSTMARK_SERVER_TOKEN" && "$(app_env_value SMTP_HOST "$file")" == *postmarkapp.com* ]]; then
      POSTMARK_SERVER_TOKEN=$(app_env_value SMTP_USER "$file")
    fi
  fi
  : "${ALERT_EMAIL_FROM:=$(app_env_value SMTP_FROM_EMAIL "$file")}"
  # : "${ALERT_EMAIL_TO:=$(app_env_value SUPPORT_EMAIL "$file")}"
  # Nov 25 2026: ALERT_EMAIL_TO in the app .env (comma-separated) wins; else SUPPORT_EMAIL
  : "${ALERT_EMAIL_TO:=$(app_env_value ALERT_EMAIL_TO "$file")}"
  : "${ALERT_EMAIL_TO:=$(app_env_value SUPPORT_EMAIL "$file")}"

  local app_url
  app_url=$(app_env_value NEXT_PUBLIC_APP_URL "$file")
  APP_PUBLIC_URL=${app_url%/}

  export DB_HOST DB_PORT DB_NAME DB_USER PGPASSWORD PGSSLMODE \
         POSTMARK_SERVER_TOKEN ALERT_EMAIL_FROM ALERT_EMAIL_TO APP_PUBLIC_URL APP_ENV_FILE_USED
}
