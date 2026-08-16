import {
  handleTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/rockets/bot-handlers";
import { isTelegramBotConfigured } from "@/lib/rockets/telegram-api";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifyWebhookSecret(request: Request): boolean {
  const expected = (
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.TELEGRAM_NOTIFY_SECRET ||
    process.env.FEED_API_SECRET ||
    ""
  ).trim();
  // If no secret configured, accept (dev) but prefer setting one in production.
  if (!expected) return true;
  const received = (
    request.headers.get("x-telegram-bot-api-secret-token") || ""
  ).trim();
  if (!received) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Telegram Bot API webhook — menu, areas, status, safe check-in. */
export async function POST(request: Request) {
  if (!isTelegramBotConfigured()) {
    return Response.json({ ok: false, error: "bot not configured" }, { status: 503 });
  }
  if (!verifyWebhookSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  try {
    const result = await handleTelegramUpdate(update);
    return Response.json({ ok: true, handled: result.handled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "handler failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
