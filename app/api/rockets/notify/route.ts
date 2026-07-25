import { dispatchNewTelegramAlerts } from "@/lib/rockets/dispatch-alerts";
import { verifyRocketNotifyAuth } from "@/lib/rockets/notify-auth";
import { isTelegramNotifyConfigured } from "@/lib/rockets/telegram-notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Poll OSINT feed and push new launch-related alerts to Telegram.
 * Auth: Bearer FEED_API_SECRET / CRON_SECRET / TELEGRAM_NOTIFY_SECRET
 */
export async function GET(request: Request) {
  if (!verifyRocketNotifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTelegramNotifyConfigured()) {
    return Response.json(
      {
        ok: false,
        configured: false,
        error:
          "Set TELEGRAM_BOT_TOKEN and TELEGRAM_ALERT_CHAT_ID in Vercel env",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const allMessages = url.searchParams.get("all") === "1";
  const result = await dispatchNewTelegramAlerts({ allMessages });
  return Response.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
