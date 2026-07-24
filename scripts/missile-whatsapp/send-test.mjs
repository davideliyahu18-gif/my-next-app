#!/usr/bin/env node
/** תור הודעת בדיקה לבוט שרץ (טקסט + מיקום לכווית). */
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
  console.log("✅ בדיקה בתור — הבוט ישלח לקבוצה תוך ~3 שניות");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
