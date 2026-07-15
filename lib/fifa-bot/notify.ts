import type { FifaBotAlert } from "./types";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE ?? "";
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN ?? "";
const WHATSAPP_GROUP_CHAT_ID = process.env.WHATSAPP_GROUP_CHAT_ID ?? "";

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

async function sendGreenApiWhatsApp(text: string): Promise<boolean> {
  if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN || !WHATSAPP_GROUP_CHAT_ID) {
    return false;
  }

  const response = await fetch(
    `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: WHATSAPP_GROUP_CHAT_ID,
        message: text,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[fifa-bot] Green API send failed:", response.status, body);
    return false;
  }
  return true;
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
    (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) ||
      (GREEN_API_INSTANCE && GREEN_API_TOKEN && WHATSAPP_GROUP_CHAT_ID),
  );
}

export async function notifyFifaBotAlert(alert: FifaBotAlert): Promise<boolean> {
  const sentTelegram = await sendTelegram(alert.text);
  const sentWhatsApp = await sendGreenApiWhatsApp(alert.text);

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
