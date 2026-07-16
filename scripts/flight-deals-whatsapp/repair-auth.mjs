#!/usr/bin/env node
/** Repair corrupted Signal sessions without full re-pair (keeps creds.json). */
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AUTH_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "auth");

async function main() {
  const files = await readdir(AUTH_DIR);
  let removed = 0;
  for (const name of files) {
    if (
      name.startsWith("session-") ||
      name.startsWith("sender-key-") ||
      name.startsWith("sender-key-memory-")
    ) {
      await unlink(path.join(AUTH_DIR, name));
      removed += 1;
    }
  }
  console.log(`Repaired auth: removed ${removed} session/sender-key files (creds kept)`);
  console.log("Restart the bot — the next group message will re-establish keys.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
