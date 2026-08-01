import { BRIDGE_MESSAGE_TITLE, boldEveryLine } from "./format";
import {
  bridgeWhatsAppChatId,
  bridgeWhatsAppGroupName,
  getBridgeChannels,
} from "./channels";
import { bridgeGreenApiInstance, isGreenApiConfigured } from "./whatsapp";

const STATUS_COMMANDS = new Set([
  "סטטוס",
  "איראן סטטוס",
  "סטטוס איראן",
  "בוט",
  "status",
]);

export function normalizeCommandText(text: string): string {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isStatusCommand(text: string): boolean {
  const normalized = normalizeCommandText(text);
  if (STATUS_COMMANDS.has(normalized)) return true;
  // Allow "סטטוס" with trailing punctuation / emoji noise.
  return /^(סטטוס|status|בוט)\b/.test(normalized);
}

export type BridgeRuntimeStatus = {
  telegramOk?: boolean;
  whatsappOk?: boolean;
  lastPollAt?: string | null;
  lastSentAt?: string | null;
  lastSentId?: string | null;
  uptimeSeconds?: number;
  errors?: string[];
};

export function formatStatusReply(runtime: BridgeRuntimeStatus = {}): string {
  const channels = getBridgeChannels();
  const channelLine = channels.length
    ? channels.map((c) => `@${c.username}`).join(", ")
    : "לא הוגדר";
  const configured = isGreenApiConfigured();
  const telegram = runtime.telegramOk === false ? "❌" : "✅";
  const whatsapp =
    runtime.whatsappOk === false || !configured ? "❌" : "✅";
  const lastPoll = runtime.lastPollAt
    ? new Date(runtime.lastPollAt).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
      })
    : "טרם";
  const lastSent = runtime.lastSentAt
    ? new Date(runtime.lastSentAt).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
      })
    : "טרם";
  const uptime =
    runtime.uptimeSeconds != null
      ? `${Math.floor(runtime.uptimeSeconds / 60)} דק׳`
      : "—";

  const lines = [
    BRIDGE_MESSAGE_TITLE,
    "",
    "סטטוס בוט — תקין",
    `וואטסאפ: ${whatsapp} מחובר`,
    `טלגרם: ${telegram} סורק`,
    `ערוץ: ${channelLine}`,
    `קבוצה: ${bridgeWhatsAppGroupName()}`,
    `מופע: ${bridgeGreenApiInstance()}`,
    `סריקה אחרונה: ${lastPoll}`,
    `שליחה אחרונה: ${lastSent}`,
    `עלייה: ${uptime}`,
    `Chat ID: ${bridgeWhatsAppChatId()}`,
  ];

  if (runtime.errors?.length) {
    lines.push(`שגיאות: ${runtime.errors.slice(0, 2).join(" | ")}`);
  } else {
    lines.push("הכל עובד — ממתין להודעות חדשות");
  }

  return boldEveryLine(lines.join("\n"));
}
