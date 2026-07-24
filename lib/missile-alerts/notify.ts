import type { MissileAlert, MissileAlertLocation } from "./types";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE ?? "";
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN ?? "";
const WHATSAPP_GROUP_CHAT_ID =
  process.env.MISSILE_WHATSAPP_CHAT_ID ||
  process.env.WHATSAPP_GROUP_CHAT_ID ||
  "";

function sendLaunchPin(): boolean {
  return (process.env.MISSILE_ALERT_SEND_LAUNCH_PIN ?? "true") === "true";
}

async function sendTelegramText(text: string): Promise<boolean> {
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
    console.error("[missile-alerts] Telegram send failed:", response.status, body);
    return false;
  }
  return true;
}

async function sendTelegramLocation(
  location: MissileAlertLocation,
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendLocation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      "[missile-alerts] Telegram location failed:",
      response.status,
      body,
    );
    return false;
  }
  return true;
}

async function sendGreenApiText(text: string): Promise<boolean> {
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
    console.error("[missile-alerts] Green API text failed:", response.status, body);
    return false;
  }
  return true;
}

async function sendGreenApiLocation(
  location: MissileAlertLocation,
): Promise<boolean> {
  if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN || !WHATSAPP_GROUP_CHAT_ID) {
    return false;
  }

  const response = await fetch(
    `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}/sendLocation/${GREEN_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: WHATSAPP_GROUP_CHAT_ID,
        nameLocation: location.name,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      "[missile-alerts] Green API location failed:",
      response.status,
      body,
    );
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
        id: `missile-${alertId}`,
        body: text,
        source: "missile-whatsapp-bot",
      }),
    });
  } catch (error) {
    console.error("[missile-alerts] Feed mirror failed:", error);
  }
}

export function isGreenApiConfigured(): boolean {
  return Boolean(GREEN_API_INSTANCE && GREEN_API_TOKEN && WHATSAPP_GROUP_CHAT_ID);
}

export function isMissileNotificationConfigured(): boolean {
  return Boolean(
    (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) || isGreenApiConfigured(),
  );
}

export async function notifyMissileAlert(
  alert: MissileAlert,
): Promise<{ whatsapp: boolean; telegram: boolean }> {
  const whatsappText = await sendGreenApiText(alert.text);
  let whatsappLocation = false;
  if (whatsappText || isGreenApiConfigured()) {
    whatsappLocation = await sendGreenApiLocation(alert.location);
    if (sendLaunchPin() && alert.launchLocation) {
      await sendGreenApiLocation(alert.launchLocation);
    }
  }

  const telegramText = await sendTelegramText(alert.text);
  let telegramLocation = false;
  if (telegramText || (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)) {
    telegramLocation = await sendTelegramLocation(alert.location);
  }

  const whatsapp = whatsappText || whatsappLocation;
  const telegram = telegramText || telegramLocation;

  if (whatsapp || telegram) {
    await mirrorToWebsiteFeed(alert.text, alert.id);
  }

  return { whatsapp, telegram };
}

export async function notifyMissileAlerts(
  alerts: MissileAlert[],
): Promise<number> {
  let notified = 0;
  for (const alert of alerts) {
    const result = await notifyMissileAlert(alert);
    if (result.whatsapp || result.telegram) notified += 1;
  }
  return notified;
}
