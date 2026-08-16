import {
  areasKeyboard,
  areasText,
  homeText,
  mainMenuKeyboard,
  mapInlineKeyboard,
  mapText,
  replyMenuKeyboard,
  safeText,
  shelterText,
  statusText,
  welcomeText,
} from "@/lib/rockets/bot-menu";
import {
  getSubscriber,
  markSubscriberSafe,
  toggleSubscriberArea,
  upsertSubscriber,
  type BotSubscriber,
} from "@/lib/rockets/bot-subscribers";
import { getRocketsSnapshot } from "@/lib/rockets/snapshot";
import {
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
} from "@/lib/rockets/telegram-api";

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number; first_name?: string; username?: string };
    message?: {
      message_id: number;
      chat: { id: number; type: string };
      text?: string;
    };
  };
};

async function ensureSub(
  chatId: number | string,
  firstName?: string,
): Promise<BotSubscriber> {
  return upsertSubscriber({
    chatId,
    firstName: firstName || undefined,
  });
}

async function buildStatusPayload() {
  const snapshot = await getRocketsSnapshot({ allowDemoFallback: true });
  return {
    related: snapshot.stats?.related ?? snapshot.feed.filter((f) => f.related).length,
    tracks: snapshot.tracks.length,
    areas: snapshot.activeAreas ?? [],
    updatedAt: snapshot.timestamp,
  };
}

async function sendHome(chatId: number | string, sub: BotSubscriber) {
  await sendTelegramMessage({
    chatId,
    text: homeText(sub),
    replyMarkup: mainMenuKeyboard(sub),
  });
}

async function editOrSend(input: {
  chatId: number | string;
  messageId?: number;
  text: string;
  replyMarkup: ReturnType<typeof mainMenuKeyboard>;
}) {
  if (input.messageId) {
    const edited = await editTelegramMessage({
      chatId: input.chatId,
      messageId: input.messageId,
      text: input.text,
      replyMarkup: input.replyMarkup,
    });
    if (edited.ok) return edited;
  }
  return sendTelegramMessage({
    chatId: input.chatId,
    text: input.text,
    replyMarkup: input.replyMarkup,
  });
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
): Promise<{ ok: boolean; handled: boolean }> {
  if (update.callback_query) {
    return handleCallback(update.callback_query);
  }
  if (update.message?.text) {
    return handleMessage(update.message);
  }
  return { ok: true, handled: false };
}

async function handleMessage(
  message: NonNullable<TelegramUpdate["message"]>,
): Promise<{ ok: boolean; handled: boolean }> {
  const chatId = message.chat.id;
  const text = (message.text ?? "").trim();
  const normalized = text.replace(/^\//, "").split(/[@\s]/)[0]?.toLowerCase();
  const sub = await ensureSub(chatId, message.from?.first_name);

  if (
    normalized === "start" ||
    text === "תפריט" ||
    normalized === "menu" ||
    text === "Menu"
  ) {
    if (normalized === "start") {
      await sendTelegramMessage({
        chatId,
        text: welcomeText(message.from?.first_name),
        replyMarkup: replyMenuKeyboard(),
      });
    }
    await sendHome(chatId, sub);
    return { ok: true, handled: true };
  }

  if (normalized === "areas" || text === "התראות שלי") {
    await sendTelegramMessage({
      chatId,
      text: areasText(sub),
      replyMarkup: areasKeyboard(sub),
    });
    return { ok: true, handled: true };
  }

  if (normalized === "shelter" || text.includes("מרחב מוגן")) {
    await sendTelegramMessage({
      chatId,
      text: shelterText(sub),
      replyMarkup: mainMenuKeyboard(sub),
    });
    return { ok: true, handled: true };
  }

  if (normalized === "map" || text === "מפה") {
    await sendTelegramMessage({
      chatId,
      text: mapText(),
      replyMarkup: mapInlineKeyboard(sub.areas[0]),
    });
    return { ok: true, handled: true };
  }

  if (normalized === "status" || text === "מצב עכשיו") {
    const status = await buildStatusPayload();
    await sendTelegramMessage({
      chatId,
      text: statusText(status),
      replyMarkup: mainMenuKeyboard(sub),
    });
    return { ok: true, handled: true };
  }

  if (normalized === "safe" || text === "אני בטוח") {
    const next = await markSubscriberSafe(chatId);
    await sendTelegramMessage({
      chatId,
      text: safeText(next),
      replyMarkup: mainMenuKeyboard(next),
    });
    return { ok: true, handled: true };
  }

  if (normalized === "mute") {
    const next = await upsertSubscriber({ chatId, muted: true });
    await sendTelegramMessage({
      chatId,
      text: "🔕 ההתראות הושתקו. /unmute להפעלה מחדש.",
      replyMarkup: mainMenuKeyboard(next),
    });
    return { ok: true, handled: true };
  }

  if (normalized === "unmute") {
    const next = await upsertSubscriber({ chatId, muted: false });
    await sendTelegramMessage({
      chatId,
      text: "🔔 ההתראות הופעלו מחדש.",
      replyMarkup: mainMenuKeyboard(next),
    });
    return { ok: true, handled: true };
  }

  // Unknown text → show menu gently.
  await sendTelegramMessage({
    chatId,
    text: "לא הבנתי — הנה התפריט:",
    replyMarkup: mainMenuKeyboard(sub),
  });
  return { ok: true, handled: true };
}

async function handleCallback(
  query: NonNullable<TelegramUpdate["callback_query"]>,
): Promise<{ ok: boolean; handled: boolean }> {
  const chatId = query.message?.chat.id ?? query.from.id;
  const messageId = query.message?.message_id;
  const data = query.data ?? "";
  let sub = await ensureSub(chatId, query.from.first_name);

  if (data === "menu:home") {
    await editOrSend({
      chatId,
      messageId,
      text: homeText(sub),
      replyMarkup: mainMenuKeyboard(sub),
    });
    await answerCallbackQuery({ callbackQueryId: query.id });
    return { ok: true, handled: true };
  }

  if (data === "menu:areas") {
    await editOrSend({
      chatId,
      messageId,
      text: areasText(sub),
      replyMarkup: areasKeyboard(sub),
    });
    await answerCallbackQuery({ callbackQueryId: query.id });
    return { ok: true, handled: true };
  }

  if (data.startsWith("area:")) {
    const areaId = data.slice("area:".length);
    if (areaId === "clear") {
      sub = await upsertSubscriber({ chatId, areas: [] });
      await answerCallbackQuery({
        callbackQueryId: query.id,
        text: "מקבלים הכל",
      });
    } else {
      sub = await toggleSubscriberArea(chatId, areaId);
      const on = sub.areas.includes(areaId);
      await answerCallbackQuery({
        callbackQueryId: query.id,
        text: on ? "נוסף" : "הוסר",
      });
    }
    await editOrSend({
      chatId,
      messageId,
      text: areasText(sub),
      replyMarkup: areasKeyboard(sub),
    });
    return { ok: true, handled: true };
  }

  if (data === "menu:shelter") {
    await editOrSend({
      chatId,
      messageId,
      text: shelterText(sub),
      replyMarkup: mainMenuKeyboard(sub),
    });
    await answerCallbackQuery({ callbackQueryId: query.id });
    return { ok: true, handled: true };
  }

  if (data === "menu:map") {
    await editOrSend({
      chatId,
      messageId,
      text: mapText(),
      replyMarkup: mapInlineKeyboard(sub.areas[0]),
    });
    await answerCallbackQuery({ callbackQueryId: query.id });
    return { ok: true, handled: true };
  }

  if (data === "menu:status") {
    const status = await buildStatusPayload();
    await editOrSend({
      chatId,
      messageId,
      text: statusText(status),
      replyMarkup: mainMenuKeyboard(sub),
    });
    await answerCallbackQuery({ callbackQueryId: query.id });
    return { ok: true, handled: true };
  }

  if (data === "menu:safe") {
    sub = await markSubscriberSafe(chatId);
    await editOrSend({
      chatId,
      messageId,
      text: safeText(sub),
      replyMarkup: mainMenuKeyboard(sub),
    });
    await answerCallbackQuery({
      callbackQueryId: query.id,
      text: "נרשמת כבטוח ✅",
    });
    return { ok: true, handled: true };
  }

  if (data === "menu:mute") {
    sub = await upsertSubscriber({ chatId, muted: !sub.muted });
    await editOrSend({
      chatId,
      messageId,
      text: homeText(sub),
      replyMarkup: mainMenuKeyboard(sub),
    });
    await answerCallbackQuery({
      callbackQueryId: query.id,
      text: sub.muted ? "מושתק" : "הופעל",
    });
    return { ok: true, handled: true };
  }

  await answerCallbackQuery({ callbackQueryId: query.id, text: "לא זמין" });
  return { ok: true, handled: true };
}

export async function getSubscriberForDebug(chatId: string) {
  return getSubscriber(chatId);
}
