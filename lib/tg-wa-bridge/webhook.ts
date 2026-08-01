import { getBridgeChannels } from "./channels";
import { markMessagesSent, wasMessageSent } from "./store";
import type { BridgeChannelMessage } from "./types";
import { forwardMessageToWhatsApp, isGreenApiConfigured } from "./whatsapp";

type TelegramChat = {
  id: number;
  type?: string;
  title?: string;
  username?: string;
};

type TelegramPhotoSize = { file_id: string; file_unique_id?: string };

type TelegramMessage = {
  message_id: number;
  date?: number;
  chat?: TelegramChat;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
};

export type TelegramBridgeUpdate = {
  update_id?: number;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

function bridgeBotToken(): string {
  return (
    process.env.TG_WA_TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.ROCKETS_TELEGRAM_BOT_TOKEN ||
    ""
  ).trim();
}

async function resolvePhotoUrl(
  fileId: string,
): Promise<string | undefined> {
  const token = bridgeBotToken();
  if (!token || !fileId) return undefined;

  try {
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
        cache: "no-store",
      },
    );
    const fileBody = (await fileRes.json().catch(() => null)) as {
      ok?: boolean;
      result?: { file_path?: string };
    } | null;
    const path = fileBody?.result?.file_path;
    if (!path) return undefined;
    return `https://api.telegram.org/file/bot${token}/${path}`;
  } catch {
    return undefined;
  }
}

function allowedChannelUsernames(): Set<string> {
  return new Set(getBridgeChannels().map((c) => c.username.toLowerCase()));
}

function channelLabelFor(username: string, title?: string): string {
  const configured = getBridgeChannels().find(
    (c) => c.username.toLowerCase() === username.toLowerCase(),
  );
  return configured?.label || title || username;
}

export async function handleBridgeTelegramUpdate(
  update: TelegramBridgeUpdate,
): Promise<{ handled: boolean; sent?: boolean; id?: string; error?: string }> {
  const post = update.channel_post || update.edited_channel_post;
  if (!post?.chat || post.chat.type !== "channel") {
    return { handled: false };
  }

  const username = (post.chat.username || "").toLowerCase();
  if (!username) {
    return {
      handled: true,
      sent: false,
      error: "ערוץ ללא username ציבורי — הוסף TG_WA_CHANNELS עם ה-id או הפוך את הערוץ לציבורי",
    };
  }

  const allowed = allowedChannelUsernames();
  if (allowed.size > 0 && !allowed.has(username)) {
    return { handled: true, sent: false, error: `ערוץ ${username} לא ברשימה` };
  }

  if (!isGreenApiConfigured()) {
    return { handled: true, sent: false, error: "Green API לא מוגדר" };
  }

  const id = `${username}:${post.message_id}`;
  if (await wasMessageSent(id)) {
    return { handled: true, sent: false, id };
  }

  const largestPhoto = post.photo?.length
    ? post.photo[post.photo.length - 1]
    : undefined;
  const imageUrl = largestPhoto
    ? await resolvePhotoUrl(largestPhoto.file_id)
    : undefined;

  const text = (post.text || post.caption || "").trim();
  const message: BridgeChannelMessage = {
    id,
    channel: username,
    channelLabel: channelLabelFor(username, post.chat.title),
    url: `https://t.me/${username}/${post.message_id}`,
    text: text || (imageUrl ? "(מדיה ללא טקסט)" : "(הודעה ללא טקסט)"),
    datetime: post.date
      ? new Date(post.date * 1000).toISOString()
      : new Date().toISOString(),
    imageUrl,
  };

  const result = await forwardMessageToWhatsApp(message);
  if (result.ok) {
    await markMessagesSent([id]);
    return { handled: true, sent: true, id };
  }
  return {
    handled: true,
    sent: false,
    id,
    error: result.error || "שליחה נכשלה",
  };
}
