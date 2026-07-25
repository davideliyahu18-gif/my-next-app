export type TelegramNotifyResult = {
  ok: boolean;
  configured: boolean;
  messageId?: number;
  error?: string;
};

function botToken(): string {
  return (
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.ROCKETS_TELEGRAM_BOT_TOKEN ||
    ""
  ).trim();
}

function chatId(): string {
  return (
    process.env.TELEGRAM_ALERT_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID ||
    process.env.ROCKETS_TELEGRAM_CHAT_ID ||
    ""
  ).trim();
}

export function isTelegramNotifyConfigured(): boolean {
  return Boolean(botToken() && chatId());
}

export async function sendTelegramAlert(
  text: string,
): Promise<TelegramNotifyResult> {
  const token = botToken();
  const chat = chatId();
  if (!token || !chat) {
    return {
      ok: false,
      configured: false,
      error:
        "חסר TELEGRAM_BOT_TOKEN או TELEGRAM_ALERT_CHAT_ID במשתני הסביבה",
    };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text,
          disable_web_page_preview: false,
        }),
        cache: "no-store",
      },
    );
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    } | null;

    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        configured: true,
        error: body?.description || `Telegram HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      configured: true,
      messageId: body.result?.message_id,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "Telegram send failed",
    };
  }
}

export function formatLaunchTelegramMessage(input: {
  text: string;
  channel: string;
  url: string;
  originLabel?: string;
  targetLabel?: string;
}): string {
  const lines = [
    "🛡️ חמ״ל התרעות איראן",
    "",
    input.text.trim(),
    "",
  ];
  if (input.originLabel || input.targetLabel) {
    lines.push(
      `מקור: ${input.originLabel ?? "—"} → יעד: ${input.targetLabel ?? "—"}`,
      "",
    );
  }
  lines.push(`מקור פיד: @${input.channel}`, input.url);
  return lines.join("\n");
}

export function formatTestTelegramMessage(): string {
  return [
    "🛡️ חמ״ל התרעות איראן",
    "",
    "✅ בדיקת מערכת — ההתראות לטלגרם עובדות.",
    "",
    `זמן: ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`,
    "מקור: Dash rockets",
  ].join("\n");
}
