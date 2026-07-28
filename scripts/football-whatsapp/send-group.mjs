#!/usr/bin/env node
/**
 * Queue a group message through the RUNNING bot outbox.
 * NEVER opens a second Baileys session (that causes 428 and kills the bot).
 *
 * Usage: node send-group.mjs "hello"
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error('Usage: node send-group.mjs "message text"');
  process.exit(1);
}

const r = spawnSync(
  process.execPath,
  [path.join(__dirname, "queue-outbox.mjs"), "--text", text],
  { stdio: "inherit" },
);
process.exit(r.status ?? 1);
