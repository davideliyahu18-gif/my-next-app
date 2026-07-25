#!/usr/bin/env node
/** Queue a test message for the running bot (no second WhatsApp session). */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRIGGER_FILE = path.join(__dirname, "test-trigger.json");

function testMessage() {
  const custom = process.argv.slice(2).join(" ").trim();
  if (custom) return custom;
  return [
    "✅ *הודעת בדיקה*",
    "",
    "הבוט פעיל ומחובר.",
    "מחפש: תאילנד · אמירטס · יציאה 15:10→07:35 · חזרה בלילה · מזוודה כלולה.",
    "כתבו *בוט מחפש* לסטטוס וחיפוש מיידי.",
  ].join("\n");
}

async function main() {
  await writeFile(
    TRIGGER_FILE,
    JSON.stringify({ text: testMessage(), at: Date.now() }, null, 2),
  );
  console.log("Test message queued — the running bot will send it within ~5s");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
