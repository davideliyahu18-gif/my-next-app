#!/usr/bin/env node
/**
 * Queue a watchlist announce through the RUNNING bot outbox.
 * NEVER opens a second Baileys session (that causes 428 and kills the bot).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const message = [
  "⭐ *מעקב קבוצה פעיל*",
  "",
  "✅ נוספה: *ברצלונה* (Barcelona)",
  "",
  "מעכשיו תזכורות · הרכבים · שערים · סיום — בעיקר לברצלונה.",
  "",
  "פקודות:",
  "• *מעקב* — רשימה",
  "• *עקוב ארסנל* — הוספה",
  "• *הסר ברצלונה* — הסרה",
].join("\n");

const r = spawnSync(
  process.execPath,
  [path.join(__dirname, "queue-outbox.mjs"), "--text", message],
  { stdio: "inherit" },
);
process.exit(r.status ?? 1);
