import { formatDealMessage } from "./format";
import type { FlightDeal } from "./types";

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
    console.error("[flight-deals] Telegram send failed:", response.status, body);
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
    console.error("[flight-deals] Green API send failed:", response.status, body);
    return false;
  }

  return true;
}

async function mirrorToWebsiteFeed(text: string, dealId: string): Promise<void> {
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
        id: `deal-${dealId}`,
        body: text,
        source: "flight-deals-bot",
      }),
    });
  } catch (error) {
    console.error("[flight-deals] Feed mirror failed:", error);
  }
}

export function isNotificationConfigured(): boolean {
  return Boolean(
    (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) ||
      (GREEN_API_INSTANCE && GREEN_API_TOKEN && WHATSAPP_GROUP_CHAT_ID),
  );
}

export async function notifyDeal(deal: FlightDeal): Promise<boolean> {
  const text = formatDealMessage(deal);

  const sentTelegram = await sendTelegram(text);
  const sentWhatsApp = await sendGreenApiWhatsApp(text);

  if (sentTelegram || sentWhatsApp) {
    await mirrorToWebsiteFeed(text, deal.id);
    return true;
  }

  console.warn(
    "[flight-deals] No notification channel configured. Set Telegram or Green API env vars.",
  );
  return false;
}

export async function notifyDeals(deals: FlightDeal[]): Promise<number> {
  let notified = 0;

  for (const deal of deals) {
    const sent = await notifyDeal(deal);
    if (sent) notified += 1;
  }

  return notified;
}
