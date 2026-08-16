import { isTelegramBotConfigured } from "@/lib/rockets/telegram-api";
import { isTelegramNotifyConfigured } from "@/lib/rockets/telegram-notify";

export const dynamic = "force-dynamic";

/** Public status — no secrets. */
export async function GET() {
  return Response.json({
    ok: true,
    configured: isTelegramNotifyConfigured() || isTelegramBotConfigured(),
    botConfigured: isTelegramBotConfigured(),
    notifyConfigured: isTelegramNotifyConfigured(),
    menu: true,
    botFather: "https://t.me/BotFather",
  });
}
