#!/usr/bin/env bash
# Run on a Mac with Xcode + Apple Developer account.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ npm install"
npm install

echo "→ Sync Capacitor iOS project"
npm run cap:sync

echo "→ Open Xcode"
npm run cap:open

cat <<'EOF'

Next in Xcode:
1. Select target "App" → Signing & Capabilities → Team = your Apple Developer team
2. Confirm Bundle Identifier: il.co.realtimefootball.app
3. Product → Archive → Distribute App → App Store Connect
4. In App Store Connect: create app, upload screenshots, privacy policy URL, submit review

Live site loaded by the app:
  https://my-next-app-5jte.vercel.app

Apple Developer Program: $99/year
EOF
