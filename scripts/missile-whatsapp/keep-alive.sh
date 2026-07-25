#!/usr/bin/env bash
# Keep the WhatsApp bot process alive across crashes (not across VM shutdown).
set -euo pipefail
cd "$(dirname "$0")"

export MISSILE_LIVE_POLL="${MISSILE_LIVE_POLL:-true}"
export MISSILE_AUTO_MODE="${MISSILE_AUTO_MODE:-true}"
export MISSILE_SEND_DEMO_ON_CONNECT="${MISSILE_SEND_DEMO_ON_CONNECT:-false}"
export MISSILE_ALERT_POLL_SECONDS="${MISSILE_ALERT_POLL_SECONDS:-30}"
export MISSILE_ALERT_SITE_URL="${MISSILE_ALERT_SITE_URL:-http://127.0.0.1:3010}"
export CRON_SECRET="${CRON_SECRET:-testsecret}"

echo "♻️ keep-alive: starting missile WhatsApp bot loop"
while true; do
  npm start || true
  echo "⚠️ bot exited — restart in 5s ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
  sleep 5
done
