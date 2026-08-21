import type { BridgeChannelMessage } from "./types";

/** Bold header on every WhatsApp forward — Hamal only, no source brand, no links. */
export const BRIDGE_MESSAGE_TITLE = "🇮🇱 חמ״ל התרעות ירי איראן 🛡️";

function truncate(text: string, max = 3500): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** Strip chars that break WhatsApp *bold* pairing. */
function sanitizeForBold(text: string): string {
  return text.replace(/\*/g, "").trim();
}

/** Make every non-empty line bold (*line*). */
export function boldEveryLine(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => sanitizeForBold(line))
    .filter(Boolean)
    .map((line) => `*${line}*`)
    .join("\n");
}

/** WhatsApp text: title + message only (never include Telegram links). */
export function formatBridgeWhatsAppMessage(
  message: BridgeChannelMessage,
): string {
  const header = `*${BRIDGE_MESSAGE_TITLE}*`;
  const body = boldEveryLine(message.text || "(הודעה)");
  return truncate(`${header}\n\n${body}`);
}
