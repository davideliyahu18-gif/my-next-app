import {
  isTelegramNotifyConfigured,
  sendTelegramMessage,
  telegramDefaultChatId,
  type TelegramApiResult,
} from "@/lib/rockets/telegram-api";

export type TelegramNotifyResult = TelegramApiResult;

export { isTelegramNotifyConfigured };

/** Send alert to the default configured group/channel chat. */
export async function sendTelegramAlert(
  text: string,
): Promise<TelegramNotifyResult> {
  const chat = telegramDefaultChatId();
  if (!chat) {
    return {
      ok: false,
      configured: false,
      error:
        "חסר TELEGRAM_BOT_TOKEN או TELEGRAM_ALERT_CHAT_ID במשתני הסביבה",
    };
  }
  return sendTelegramMessage({ chatId: chat, text });
}

/** Send alert to any chat (subscribers / DMs). */
export async function sendTelegramAlertToChat(
  chatId: string | number,
  text: string,
): Promise<TelegramNotifyResult> {
  return sendTelegramMessage({ chatId, text });
}

export function formatLaunchTelegramMessage(input: {
  text: string;
  channel: string;
  url: string;
  originLabel?: string;
  targetLabel?: string;
  areaLabels?: string[];
  shelterSeconds?: number;
  mapUrl?: string;
  weaponHint?: string;
}): string {
  const lines = ["🛡️ חמ״ל לייב", ""];

  if (input.weaponHint && input.weaponHint !== "לא צוין") {
    lines.push(`סוג: ${input.weaponHint}`);
  }
  if (input.areaLabels && input.areaLabels.length > 0) {
    lines.push(`אזור: ${input.areaLabels.join(" · ")}`);
  } else if (input.targetLabel) {
    lines.push(`יעד: ${input.targetLabel}`);
  }
  if (input.shelterSeconds != null) {
    const shelter =
      input.shelterSeconds <= 0
        ? "מיידי"
        : input.shelterSeconds < 60
          ? `${input.shelterSeconds} שניות`
          : `${Math.floor(input.shelterSeconds / 60)}:${String(input.shelterSeconds % 60).padStart(2, "0")} דק׳`;
    lines.push(`⏱️ זמן למרחב מוגן: ${shelter}`);
  }
  if (input.mapUrl) {
    lines.push(`🗺️ מפה חיה: ${input.mapUrl}`);
  }
  if (
    input.weaponHint ||
    input.areaLabels?.length ||
    input.targetLabel ||
    input.shelterSeconds != null ||
    input.mapUrl
  ) {
    lines.push("");
  }

  lines.push(input.text.trim(), "");

  if (input.originLabel || input.targetLabel) {
    lines.push(
      `מקור: ${input.originLabel ?? "—"} → יעד: ${input.targetLabel ?? "—"}`,
      "",
    );
  }
  lines.push(
    "⚠️ הערכת OSINT בלבד — לא מחליף התראת פיקוד העורף",
    "",
    `מקור פיד: @${input.channel}`,
    input.url,
  );
  return lines.join("\n");
}

export function formatTestTelegramMessage(): string {
  return [
    "🛡️ חמ״ל לייב",
    "",
    "✅ בדיקת מערכת — תפריט + אזורים + זמן למרחב מוגן + מפה.",
    "",
    "שלחו /start לבוט כדי לפתוח את התפריט.",
    "",
    `זמן: ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`,
    "מקור: Dash rockets",
  ].join("\n");
}
