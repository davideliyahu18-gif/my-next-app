import { verifyBridgeAuth } from "@/lib/tg-wa-bridge/auth";
import { isBridgeConfigured } from "@/lib/tg-wa-bridge/poll";
import { sendWhatsAppText } from "@/lib/tg-wa-bridge/whatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Send a one-off test message to the configured WhatsApp group. */
export async function POST(request: Request) {
  if (!verifyBridgeAuth(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBridgeConfigured()) {
    return Response.json(
      {
        ok: false,
        error:
          "חסרים TG_WA_CHANNELS + GREEN_API_* + TG_WA_WHATSAPP_CHAT_ID",
      },
      { status: 503 },
    );
  }

  let customText = "";
  try {
    const body = (await request.json()) as { text?: string };
    customText = (body.text || "").trim();
  } catch {
    // optional body
  }

  const text =
    customText ||
    `*✅ בדיקת גשר טלגרם → וואטסאפ*\nהחיבור עובד\n${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`;

  const result = await sendWhatsAppText(text);
  return Response.json(
    { ok: result.ok, error: result.error },
    { status: result.ok ? 200 : 502 },
  );
}
