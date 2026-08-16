/** Low-level Telegram Bot API helpers. */

export type TelegramApiResult = {
  ok: boolean;
  configured: boolean;
  messageId?: number;
  error?: string;
  raw?: unknown;
};

export type InlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type ReplyMarkup =
  | { inline_keyboard: InlineButton[][] }
  | {
      keyboard: { text: string }[][];
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
    }
  | { remove_keyboard: true };

export function telegramBotToken(): string {
  return (
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.ROCKETS_TELEGRAM_BOT_TOKEN ||
    ""
  ).trim();
}

export function telegramDefaultChatId(): string {
  return (
    process.env.TELEGRAM_ALERT_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID ||
    process.env.ROCKETS_TELEGRAM_CHAT_ID ||
    ""
  ).trim();
}

export function isTelegramBotConfigured(): boolean {
  return Boolean(telegramBotToken());
}

export function isTelegramNotifyConfigured(): boolean {
  return Boolean(telegramBotToken() && telegramDefaultChatId());
}

async function callTelegramApi(
  method: string,
  payload: Record<string, unknown>,
): Promise<TelegramApiResult> {
  const token = telegramBotToken();
  if (!token) {
    return {
      ok: false,
      configured: false,
      error: "חסר TELEGRAM_BOT_TOKEN",
    };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        raw: body,
      };
    }

    return {
      ok: true,
      configured: true,
      messageId: body.result?.message_id,
      raw: body.result,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "Telegram API failed",
    };
  }
}

export async function sendTelegramMessage(input: {
  chatId: string | number;
  text: string;
  replyMarkup?: ReplyMarkup;
  disableWebPagePreview?: boolean;
}): Promise<TelegramApiResult> {
  return callTelegramApi("sendMessage", {
    chat_id: input.chatId,
    text: input.text,
    disable_web_page_preview: input.disableWebPagePreview ?? false,
    ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
  });
}

export async function editTelegramMessage(input: {
  chatId: string | number;
  messageId: number;
  text: string;
  replyMarkup?: ReplyMarkup;
}): Promise<TelegramApiResult> {
  return callTelegramApi("editMessageText", {
    chat_id: input.chatId,
    message_id: input.messageId,
    text: input.text,
    disable_web_page_preview: true,
    ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
  });
}

export async function answerCallbackQuery(input: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}): Promise<TelegramApiResult> {
  return callTelegramApi("answerCallbackQuery", {
    callback_query_id: input.callbackQueryId,
    text: input.text,
    show_alert: input.showAlert ?? false,
  });
}

export async function setTelegramMyCommands(
  commands: { command: string; description: string }[],
): Promise<TelegramApiResult> {
  return callTelegramApi("setMyCommands", { commands });
}

export async function setTelegramWebhook(input: {
  url: string;
  secretToken?: string;
}): Promise<TelegramApiResult> {
  return callTelegramApi("setWebhook", {
    url: input.url,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
    ...(input.secretToken ? { secret_token: input.secretToken } : {}),
  });
}

export async function getTelegramWebhookInfo(): Promise<TelegramApiResult> {
  return callTelegramApi("getWebhookInfo", {});
}
