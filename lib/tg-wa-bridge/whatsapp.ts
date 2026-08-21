import { bridgeWhatsAppChatId, bridgeWhatsAppChatIds } from "./channels";
import { formatBridgeWhatsAppMessage } from "./format";
import type { BridgeChannelMessage } from "./types";

/** Default instance from console.green-api.com (must be authorized via QR). */
const DEFAULT_GREEN_API_INSTANCE = "710722683401";

function greenApiInstance(): string {
  return (
    process.env.GREEN_API_INSTANCE ||
    process.env.TG_WA_GREEN_API_INSTANCE ||
    DEFAULT_GREEN_API_INSTANCE
  ).trim();
}

function greenApiToken(): string {
  return (
    process.env.GREEN_API_TOKEN ||
    process.env.TG_WA_GREEN_API_TOKEN ||
    ""
  ).trim();
}

export function bridgeGreenApiInstance(): string {
  return greenApiInstance();
}

export function isGreenApiConfigured(): boolean {
  return Boolean(
    greenApiInstance() &&
      greenApiToken() &&
      (bridgeWhatsAppChatIds().length > 0 || bridgeWhatsAppChatId()),
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

export async function sendWhatsAppTextToAll(
  text: string,
  chatIds = bridgeWhatsAppChatIds(),
): Promise<{
  ok: boolean;
  results: { chatId: string; ok: boolean; error?: string }[];
}> {
  const targets = chatIds.length
    ? chatIds
    : [bridgeWhatsAppChatId()].filter(Boolean);
  const results: { chatId: string; ok: boolean; error?: string }[] = [];
  for (const chatId of targets) {
    const result = await sendWhatsAppText(text, chatId);
    results.push({ chatId, ok: result.ok, error: result.error });
  }
  return { ok: results.some((r) => r.ok), results };
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
  const chatIds = bridgeWhatsAppChatIds();
  const errors: string[] = [];
  let anyOk = false;

  for (const chatId of chatIds) {
    if (message.imageUrl) {
      const fileResult = await sendWhatsAppFileByUrl({
        url: message.imageUrl,
        caption: text,
        fileName: `${message.channel}-${message.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`,
        chatId,
      });
      if (fileResult.ok) {
        anyOk = true;
        continue;
      }
      console.warn(
        "[tg-wa-bridge] sendFileByUrl failed, falling back to text:",
        chatId,
        fileResult.error,
      );
    }

    const textResult = await sendWhatsAppText(text, chatId);
    if (textResult.ok) anyOk = true;
    else if (textResult.error) errors.push(`${chatId}: ${textResult.error}`);
  }

  return {
    ok: anyOk,
    error: anyOk ? undefined : errors.join(" | ") || "שליחה נכשלה",
  };
}
