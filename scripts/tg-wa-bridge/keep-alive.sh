#!/usr/bin/env bash
# Simple restart loop if you prefer bash over supervise.mjs
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "♻️ tg-wa keep-alive starting $(date -u +%Y-%m-%dT%H:%M:%SZ)"
while true; do
  node scripts/tg-wa-bridge/cloud-poller.mjs || true
  echo "⚠️ poller exited — restart in 5s ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
  sleep 5
done
