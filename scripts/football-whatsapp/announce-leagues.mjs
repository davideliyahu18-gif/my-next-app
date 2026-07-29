#!/usr/bin/env node
/**
 * Queue a leagues announce through the RUNNING bot outbox.
 * NEVER opens a second Baileys session (that causes 428 and kills the bot).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const message = [
  "🏆 *הליגות מסודרות!*",
  "",
  "הבוט עוקב עכשיו אחרי:",
  "• 🏴󠁧󠁢󠁥󠁮󠁧󠁿 *פרמייר ליג* (אנגלית)",
  "• 🇪🇸 *לה ליגה* (ספרדית)",
  "• 🇮🇱 *ליגת העל* (ישראלית)",
  "• 🇮🇹 *סרייה א׳* (איטלקית)",
  "• 🇩🇪 *בונדסליגה* (גרמנית)",
  "",
  "כתבו בקבוצה:",
  "*ליגות* · *לוח* · *תוצאה* · *מחר* · *עזרה*",
  "",
  "התראות שער / פתיחה / מחצית / סיום — אוטומטי ✅",
].join("\n");

const r = spawnSync(
  process.execPath,
  [path.join(__dirname, "queue-outbox.mjs"), "--text", message],
  { stdio: "inherit" },
);
process.exit(r.status ?? 1);
