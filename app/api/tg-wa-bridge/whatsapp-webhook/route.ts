import {
  handleBridgeCommand,
  parseBridgeCommand,
} from "@/lib/tg-wa-bridge/commands";
import { bridgeWhatsAppChatId } from "@/lib/tg-wa-bridge/channels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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
 * Optional Green API webhook endpoint for group commands.
 * Prefer cloud-poller receiveNotification / lastOutgoing while the poller runs.
 */
export async function POST(request: Request) {
  let body: GreenIncoming;
  try {
    body = (await request.json()) as GreenIncoming;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Linked phone (same WID) sends as outgoingMessageReceived.
  if (
    body.typeWebhook !== "incomingMessageReceived" &&
    body.typeWebhook !== "outgoingMessageReceived"
  ) {
    return Response.json({ ok: true, ignored: true });
  }

  const chatId = body.senderData?.chatId || "";
  const target = bridgeWhatsAppChatId();
  if (!chatId || chatId !== target) {
    return Response.json({ ok: true, ignored: "other chat" });
  }

  const text = extractText(body);
  const command = parseBridgeCommand(text);
  if (!command) {
    return Response.json({ ok: true, ignored: "not a command" });
  }

  const result = await handleBridgeCommand(
    command,
    { whatsappOk: true, telegramOk: true },
    chatId,
  );
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
