import { isTelegramNotifyConfigured } from "@/lib/rockets/telegram-notify";

export const dynamic = "force-dynamic";

/** Public status — no secrets. */
export async function GET() {
  return Response.json({
    ok: true,
    configured: isTelegramNotifyConfigured(),
    botFather: "https://t.me/BotFather",
  });
}
