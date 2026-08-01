import {
  bridgeWhatsAppChatId,
  bridgeWhatsAppGroupName,
  getBridgeChannels,
} from "./channels";
import {
  BRIDGE_MESSAGE_TITLE,
  boldEveryLine,
  formatBridgeWhatsAppMessage,
} from "./format";
import { fetchBridgeChannels } from "./scrape";
import {
  bridgeGreenApiInstance,
  isGreenApiConfigured,
  sendWhatsAppText,
} from "./whatsapp";
import type { BridgeChannelMessage } from "./types";

export type BridgeCommand =
  | "status"
  | "help"
  | "source"
  | "test"
  | "last"
  | null;

export function normalizeCommandText(text: string): string {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[!?.،,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseBridgeCommand(text: string): BridgeCommand {
  const normalized = normalizeCommandText(text);
  if (
    normalized === "סטטוס" ||
    normalized === "איראן סטטוס" ||
    normalized === "סטטוס איראן" ||
    normalized === "בוט" ||
    normalized === "status"
  ) {
    return "status";
  }
  if (normalized === "עזרה" || normalized === "help" || normalized === "פקודות") {
    return "help";
  }
  if (normalized === "מקור" || normalized === "source" || normalized === "ערוץ") {
    return "source";
  }
  if (
    normalized === "בדיקה" ||
    normalized === "test" ||
    normalized === "טסט"
  ) {
    return "test";
  }
  if (
    normalized === "אחרון" ||
    normalized === "last" ||
    normalized === "אחרונה"
  ) {
    return "last";
  }
  return null;
}

/** @deprecated use parseBridgeCommand */
export function isStatusCommand(text: string): boolean {
  return parseBridgeCommand(text) === "status";
}

export function isBridgeCommand(text: string): boolean {
  return parseBridgeCommand(text) != null;
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

function primaryChannel() {
  return getBridgeChannels()[0] ?? {
    username: "mivzakeybitachon2225",
    label: "מבזקי ביטחון 24/7",
  };
}

export function formatHelpReply(): string {
  const lines = [
    BRIDGE_MESSAGE_TITLE,
    "",
    "פקודות בוט",
    "סטטוס — האם הבוט תקין",
    "עזרה — רשימת פקודות",
    "מקור — קישור לערוץ הטלגרם",
    "בדיקה — הודעת בדיקה לקבוצה",
    "אחרון — ההודעה האחרונה מהערוץ",
  ];
  return boldEveryLine(lines.join("\n"));
}

export function formatSourceReply(): string {
  const channel = primaryChannel();
  const lines = [
    BRIDGE_MESSAGE_TITLE,
    "",
    "מקור הדיווחים",
    `ערוץ: @${channel.username}`,
    `שם: ${channel.label}`,
    `קישור: https://t.me/${channel.username}`,
    `תצוגה: https://t.me/s/${channel.username}`,
    `קבוצה: ${bridgeWhatsAppGroupName()}`,
  ];
  return boldEveryLine(lines.join("\n"));
}

export function formatTestReply(): string {
  const now = new Date().toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
  });
  const lines = [
    BRIDGE_MESSAGE_TITLE,
    "",
    "בדיקה — תקין",
    "הבוט מחובר ומוכן",
    `שעה: ${now}`,
  ];
  return boldEveryLine(lines.join("\n"));
}

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
    "פקודות: עזרה",
  ];

  if (runtime.errors?.length) {
    lines.push(`שגיאות: ${runtime.errors.slice(0, 2).join(" | ")}`);
  } else {
    lines.push("הכל עובד — ממתין להודעות חדשות");
  }

  return boldEveryLine(lines.join("\n"));
}

export async function fetchLatestChannelMessage(): Promise<BridgeChannelMessage | null> {
  const channels = getBridgeChannels();
  const { messages } = await fetchBridgeChannels(
    channels.length ? channels : [primaryChannel()],
  );
  if (!messages.length) return null;
  return messages[messages.length - 1] ?? null;
}

export async function handleBridgeCommand(
  command: Exclude<BridgeCommand, null>,
  runtime: BridgeRuntimeStatus = {},
  chatId = bridgeWhatsAppChatId(),
): Promise<{ ok: boolean; command: string; error?: string }> {
  if (command === "help") {
    return {
      ok: (await sendWhatsAppText(formatHelpReply(), chatId)).ok,
      command,
    };
  }
  if (command === "source") {
    return {
      ok: (await sendWhatsAppText(formatSourceReply(), chatId)).ok,
      command,
    };
  }
  if (command === "test") {
    return {
      ok: (await sendWhatsAppText(formatTestReply(), chatId)).ok,
      command,
    };
  }
  if (command === "status") {
    return {
      ok: (await sendWhatsAppText(formatStatusReply(runtime), chatId)).ok,
      command,
    };
  }
  if (command === "last") {
    try {
      const latest = await fetchLatestChannelMessage();
      if (!latest) {
        const empty = boldEveryLine(
          `${BRIDGE_MESSAGE_TITLE}\n\nאין הודעה אחרונה מהערוץ`,
        );
        return {
          ok: (await sendWhatsAppText(empty, chatId)).ok,
          command,
        };
      }
      const text = formatBridgeWhatsAppMessage(latest);
      return {
        ok: (await sendWhatsAppText(text, chatId)).ok,
        command,
      };
    } catch (error) {
      return {
        ok: false,
        command,
        error: error instanceof Error ? error.message : "last failed",
      };
    }
  }
  return { ok: false, command, error: "unknown" };
}
