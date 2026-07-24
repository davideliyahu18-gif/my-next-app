#!/usr/bin/env node
/** Queue a demo Iran→Kuwait alert for the running Baileys bot. */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRIGGER_FILE = path.join(__dirname, "test-trigger.json");

async function main() {
  await writeFile(
    TRIGGER_FILE,
    JSON.stringify({ at: Date.now(), kind: "demo-kuwait" }, null, 2),
  );
  console.log(
    "Demo alert queued — running bot will send text + location within ~5s",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
