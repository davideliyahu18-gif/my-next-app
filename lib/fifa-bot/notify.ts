import { alertAllowedForChannel, type FifaBotChannel } from "./channels";
import type { FifaBotAlert } from "./types";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE ?? "";
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN ?? "";

const MAIN_CHAT_ID =
  process.env.FIFA_WHATSAPP_MAIN_CHAT_ID ||
  process.env.WHATSAPP_GROUP_CHAT_ID ||
  "";
const VIP_CHAT_ID = process.env.FIFA_WHATSAPP_VIP_CHAT_ID || "";

function chatIdForChannel(channel: FifaBotChannel): string {
  return channel === "main" ? MAIN_CHAT_ID : VIP_CHAT_ID;
}

async function sendTelegram(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: false,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[fifa-bot] Telegram send failed:", response.status, body);
    return false;
  }
  return true;
}

async function sendGreenApiToChat(
  chatId: string,
  text: string,
): Promise<boolean> {
  if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN || !chatId) return false;

  const response = await fetch(
    `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        message: text,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      "[fifa-bot] Green API send failed:",
      chatId,
      response.status,
      body,
    );
    return false;
  }
  return true;
}

export function isGreenApiConfigured(): boolean {
  return Boolean(
    GREEN_API_INSTANCE &&
      GREEN_API_TOKEN &&
      (MAIN_CHAT_ID || VIP_CHAT_ID),
  );
}

export async function sendWhatsAppToChannels(
  text: string,
  channels: FifaBotChannel[] = ["main", "vip"],
): Promise<{ channel: FifaBotChannel; ok: boolean; chatId: string }[]> {
  const results: { channel: FifaBotChannel; ok: boolean; chatId: string }[] =
    [];

  for (const channel of channels) {
    const chatId = chatIdForChannel(channel);
    if (!chatId) {
      results.push({ channel, ok: false, chatId: "" });
      continue;
    }
    const ok = await sendGreenApiToChat(chatId, text);
    results.push({ channel, ok, chatId });
  }

  return results;
}

async function sendGreenApiWhatsApp(alert: FifaBotAlert): Promise<boolean> {
  const channels: FifaBotChannel[] = [];
  if (alertAllowedForChannel(alert.kind, "main")) channels.push("main");
  if (alertAllowedForChannel(alert.kind, "vip")) channels.push("vip");

  const results = await sendWhatsAppToChannels(alert.text, channels);
  return results.some((result) => result.ok);
}

async function mirrorToWebsiteFeed(text: string, alertId: string): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL;
  const feedSecret = process.env.FEED_API_SECRET;
  if (!siteUrl || !feedSecret) return;

  const base = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;

  try {
    await fetch(`${base}/api/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${feedSecret}`,
      },
      body: JSON.stringify({
        id: `fifa-${alertId}`,
        body: text,
        source: "fifa-bot",
      }),
    });
  } catch (error) {
    console.error("[fifa-bot] Feed mirror failed:", error);
  }
}

export function isFifaBotNotificationConfigured(): boolean {
  return Boolean(
    (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) || isGreenApiConfigured(),
  );
}

export async function notifyFifaBotAlert(alert: FifaBotAlert): Promise<boolean> {
  const sentTelegram = await sendTelegram(alert.text);
  const sentWhatsApp = await sendGreenApiWhatsApp(alert);

  if (sentTelegram || sentWhatsApp) {
    await mirrorToWebsiteFeed(alert.text, alert.id);
    return true;
  }

  return false;
}

export async function notifyFifaBotAlerts(alerts: FifaBotAlert[]): Promise<number> {
  let notified = 0;
  for (const alert of alerts) {
    if (await notifyFifaBotAlert(alert)) notified += 1;
  }
  return notified;
}
