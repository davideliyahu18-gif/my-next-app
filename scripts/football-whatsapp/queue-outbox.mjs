#!/usr/bin/env node
/**
 * Queue a WhatsApp group message via the RUNNING bot outbox.
 * NEVER opens a second Baileys session (that kicks the live bot).
 *
 * Usage:
 *   node queue-outbox.mjs --text "hello"
 *   node queue-outbox.mjs --text "caption" --image /path/to.png
 *   node announce-roster.mjs   (uses this under the hood)
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX_DIR = path.join(__dirname, "outbox");

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

const text = argValue("--text");
const imagePath = argValue("--image");
const caption = argValue("--caption") || text;

if (!text && !imagePath) {
  console.error("Need --text and/or --image");
  process.exit(1);
}

await mkdir(OUTBOX_DIR, { recursive: true });

const job = {
  queuedAt: new Date().toISOString(),
  text: text || undefined,
  caption: caption || undefined,
};

if (imagePath) {
  const buf = await readFile(imagePath);
  job.imageBase64 = buf.toString("base64");
  job.mime = "image/png";
}

const file = path.join(OUTBOX_DIR, `${Date.now()}-job.json`);
await writeFile(file, JSON.stringify(job), "utf8");
console.log(`QUEUED_OK ${file}`);
