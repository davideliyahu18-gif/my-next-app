import { verifyTelegramWebhookSecret } from "@/lib/tg-wa-bridge/auth";
import {
  handleBridgeTelegramUpdate,
  type TelegramBridgeUpdate,
} from "@/lib/tg-wa-bridge/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Optional Telegram Bot webhook for instant channel_post forwarding.
 * Requires: bot added as admin to the channel + TG_WA_CHANNELS includes it.
 */
export async function POST(request: Request) {
  if (!verifyTelegramWebhookSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramBridgeUpdate;
  try {
    update = (await request.json()) as TelegramBridgeUpdate;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  try {
    const result = await handleBridgeTelegramUpdate(update);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "handler failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
