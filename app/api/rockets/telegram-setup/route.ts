import { BOT_COMMANDS } from "@/lib/rockets/bot-menu";
import { verifyRocketNotifyAuth } from "@/lib/rockets/notify-auth";
import { siteBaseUrl } from "@/lib/rockets/alert-areas";
import {
  getTelegramWebhookInfo,
  isTelegramBotConfigured,
  setTelegramMyCommands,
  setTelegramWebhook,
} from "@/lib/rockets/telegram-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Register Telegram webhook + bot command menu.
 * Auth: Bearer FEED_API_SECRET / TELEGRAM_NOTIFY_SECRET / CRON_SECRET
 *
 * Optional body: { "url": "https://your-app.vercel.app/api/rockets/telegram-webhook" }
 */
export async function POST(request: Request) {
  if (!verifyRocketNotifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTelegramBotConfigured()) {
    return Response.json(
      { ok: false, error: "Set TELEGRAM_BOT_TOKEN" },
      { status: 503 },
    );
  }

  let overrideUrl: string | undefined;
  try {
    const body = (await request.json()) as { url?: string };
    overrideUrl = body.url?.trim();
  } catch {
    // empty body is fine
  }

  const base = siteBaseUrl();
  const webhookUrl =
    overrideUrl ||
    (base ? `${base}/api/rockets/telegram-webhook` : "");

  if (!webhookUrl) {
    return Response.json(
      {
        ok: false,
        error:
          "Missing webhook URL — pass { url } or set WEBSITE_URL / VERCEL_URL",
      },
      { status: 400 },
    );
  }

  const secret = (
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.TELEGRAM_NOTIFY_SECRET ||
    process.env.FEED_API_SECRET ||
    ""
  ).trim();

  const commands = await setTelegramMyCommands([...BOT_COMMANDS]);
  const webhook = await setTelegramWebhook({
    url: webhookUrl,
    secretToken: secret || undefined,
  });
  const info = await getTelegramWebhookInfo();

  return Response.json({
    ok: webhook.ok && commands.ok,
    webhookUrl,
    commands,
    webhook,
    info: info.raw,
  });
}

export async function GET(request: Request) {
  if (!verifyRocketNotifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const info = await getTelegramWebhookInfo();
  return Response.json({ ok: info.ok, info: info.raw });
}
