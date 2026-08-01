import { bridgeWhatsAppChatId } from "./channels";
import { formatBridgeWhatsAppMessage } from "./format";
import type { BridgeChannelMessage } from "./types";

function greenApiInstance(): string {
  return (process.env.GREEN_API_INSTANCE ?? "").trim();
}

function greenApiToken(): string {
  return (process.env.GREEN_API_TOKEN ?? "").trim();
}

export function isGreenApiConfigured(): boolean {
  return Boolean(
    greenApiInstance() && greenApiToken() && bridgeWhatsAppChatId(),
  );
}

async function greenApiCall(
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const instance = greenApiInstance();
  const token = greenApiToken();
  if (!instance || !token) {
    return { ok: false, error: "חסר GREEN_API_INSTANCE / GREEN_API_TOKEN" };
  }

  const response = await fetch(
    `https://api.green-api.com/waInstance${instance}/${method}/${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: `Green API ${method} HTTP ${response.status}: ${body.slice(0, 240)}`,
    };
  }
  return { ok: true };
}

export async function sendWhatsAppText(
  text: string,
  chatId = bridgeWhatsAppChatId(),
): Promise<{ ok: boolean; error?: string }> {
  if (!chatId) return { ok: false, error: "חסר TG_WA_WHATSAPP_CHAT_ID" };
  return greenApiCall("sendMessage", { chatId, message: text });
}

export async function sendWhatsAppFileByUrl(input: {
  url: string;
  caption?: string;
  fileName?: string;
  chatId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const chatId = input.chatId || bridgeWhatsAppChatId();
  if (!chatId) return { ok: false, error: "חסר TG_WA_WHATSAPP_CHAT_ID" };
  return greenApiCall("sendFileByUrl", {
    chatId,
    urlFile: input.url,
    fileName: input.fileName || "image.jpg",
    caption: input.caption || "",
  });
}

export async function forwardMessageToWhatsApp(
  message: BridgeChannelMessage,
): Promise<{ ok: boolean; error?: string }> {
  const text = formatBridgeWhatsAppMessage(message);

  if (message.imageUrl) {
    const fileResult = await sendWhatsAppFileByUrl({
      url: message.imageUrl,
      caption: text,
      fileName: `${message.channel}-${message.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`,
    });
    if (fileResult.ok) return fileResult;
    // Fall back to text-only if media send fails.
    console.warn(
      "[tg-wa-bridge] sendFileByUrl failed, falling back to text:",
      fileResult.error,
    );
  }

  return sendWhatsAppText(text);
}
