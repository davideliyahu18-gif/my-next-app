import { verifyRocketNotifyAuth } from "@/lib/rockets/notify-auth";
import {
  formatTestTelegramMessage,
  isTelegramNotifyConfigured,
  sendTelegramAlert,
} from "@/lib/rockets/telegram-notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Send a one-off Telegram test message to the configured chat. */
export async function POST(request: Request) {
  if (!verifyRocketNotifyAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTelegramNotifyConfigured()) {
    return Response.json(
      {
        ok: false,
        configured: false,
        error:
          "Set TELEGRAM_BOT_TOKEN and TELEGRAM_ALERT_CHAT_ID, then redeploy",
        setup: {
          botFather: "https://t.me/BotFather",
          steps: [
            "פתח @BotFather → /newbot",
            "העתק את ה-TOKEN",
            "צור קבוצה/ערוץ והוסף את הבוט",
            "שלח הודעה בקבוצה ואז שלוף chat_id",
          ],
        },
      },
      { status: 503 },
    );
  }

  const result = await sendTelegramAlert(formatTestTelegramMessage());
  return Response.json(result, { status: result.ok ? 200 : 502 });
}

export async function GET(request: Request) {
  return POST(request);
}
