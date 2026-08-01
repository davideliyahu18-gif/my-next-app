import { verifyBridgeAuth } from "@/lib/tg-wa-bridge/auth";
import {
  bridgeWhatsAppChatId,
  bridgeWhatsAppGroupName,
  getBridgeChannels,
  isBridgeEnabled,
} from "@/lib/tg-wa-bridge/channels";
import { isBridgeConfigured } from "@/lib/tg-wa-bridge/poll";
import { isBridgeBootstrapped } from "@/lib/tg-wa-bridge/store";
import { isGreenApiConfigured } from "@/lib/tg-wa-bridge/whatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyBridgeAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = getBridgeChannels();
  return Response.json({
    ok: true,
    enabled: isBridgeEnabled(),
    configured: isBridgeConfigured(),
    greenApi: isGreenApiConfigured(),
    whatsappGroupName: bridgeWhatsAppGroupName(),
    whatsappChatId: bridgeWhatsAppChatId()
      ? `${bridgeWhatsAppChatId().slice(0, 8)}…`
      : "",
    channels: channels.map((c) => ({
      username: c.username,
      label: c.label,
      url: `https://t.me/${c.username}`,
      preview: `https://t.me/s/${c.username}`,
    })),
    bootstrapped: await isBridgeBootstrapped(),
    pollPath: "/api/cron/tg-wa-bridge",
    groupsPath: "/api/tg-wa-bridge/groups",
    webhookPath: "/api/tg-wa-bridge/webhook",
  });
}
