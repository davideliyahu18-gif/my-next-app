#!/usr/bin/env node
/**
 * Full WhatsApp re-link — wipes auth, keeps group JID in bot-state.
 * Run: npm run flight-deals:relink
 */
import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "auth");
const TRIGGER_FILE = path.join(__dirname, "test-trigger.json");

async function main() {
  if (existsSync(AUTH_DIR)) {
    await rm(AUTH_DIR, { recursive: true, force: true });
    console.log("Removed WhatsApp auth — fresh link required.");
  }
  if (existsSync(TRIGGER_FILE)) {
    await rm(TRIGGER_FILE, { force: true });
  }
  console.log("");
  console.log("Next: npm run flight-deals:start");
  console.log("Then on your phone:");
  console.log("  WhatsApp → Settings → Linked devices → Link a device");
  console.log("  Scan the QR from the terminal, OR enter the pairing code shown.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
