import { isStatusCommand, formatStatusReply } from "@/lib/tg-wa-bridge/commands";
import { bridgeWhatsAppChatId } from "@/lib/tg-wa-bridge/channels";
import { sendWhatsAppText } from "@/lib/tg-wa-bridge/whatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GreenIncoming = {
  typeWebhook?: string;
  senderData?: { chatId?: string; senderName?: string };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessageData?: { text?: string };
  };
};

function extractText(body: GreenIncoming): string {
  const md = body.messageData;
  if (!md) return "";
  if (md.typeMessage === "textMessage") {
    return md.textMessageData?.textMessage || "";
  }
  return md.extendedTextMessageData?.text || "";
}

/**
 * Optional Green API webhook endpoint for group commands (סטטוס).
 * Prefer cloud-poller receiveNotification while the poller is running.
 */
export async function POST(request: Request) {
  let body: GreenIncoming;
  try {
    body = (await request.json()) as GreenIncoming;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (body.typeWebhook !== "incomingMessageReceived") {
    return Response.json({ ok: true, ignored: true });
  }

  const chatId = body.senderData?.chatId || "";
  const target = bridgeWhatsAppChatId();
  if (!chatId || chatId !== target) {
    return Response.json({ ok: true, ignored: "other chat" });
  }

  const text = extractText(body);
  if (!isStatusCommand(text)) {
    return Response.json({ ok: true, ignored: "not a command" });
  }

  const reply = formatStatusReply({
    whatsappOk: true,
    telegramOk: true,
  });
  const result = await sendWhatsAppText(reply, chatId);
  return Response.json({
    ok: result.ok,
    command: "status",
    error: result.error,
  });
}
