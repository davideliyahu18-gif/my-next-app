import type { BridgeChannelMessage } from "./types";

function truncate(text: string, max = 3500): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** WhatsApp-friendly text (Green API uses WhatsApp markdown: *bold*). */
export function formatBridgeWhatsAppMessage(
  message: BridgeChannelMessage,
): string {
  const header = `*📢 ${message.channelLabel}*`;
  const body = message.text.trim();
  const link = message.url ? `\n\n🔗 ${message.url}` : "";
  return truncate(`${header}\n\n${body}${link}`);
}
