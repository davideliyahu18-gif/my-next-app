import type { BridgeChannelConfig } from "./types";

/** Default: https://t.me/Mivzakeybitachon2225 */
const DEFAULT_CHANNELS: BridgeChannelConfig[] = [
  {
    username: "mivzakeybitachon2225",
    label: "מבזקי ביטחון 24/7",
  },
];

/** WhatsApp group the user opened for this bridge. */
export const DEFAULT_WHATSAPP_GROUP_NAME = "דיווחים מבצעי איראן 🇮🇷";

/**
 * Channels to forward.
 * Format: username or username:Label, comma-separated.
 * Default: Mivzakeybitachon2225
 */
export function getBridgeChannels(): BridgeChannelConfig[] {
  const raw = (
    process.env.TG_WA_CHANNELS ||
    process.env.TELEGRAM_BRIDGE_CHANNELS ||
    ""
  ).trim();

  if (!raw) return DEFAULT_CHANNELS;

  const parsed = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [usernameRaw, ...labelParts] = part.split(":");
      const username = usernameRaw.replace(/^@/, "").trim().toLowerCase();
      const label = labelParts.join(":").trim() || username;
      return { username, label };
    })
    .filter((channel) => /^[a-zA-Z][a-zA-Z0-9_]{3,}$/.test(channel.username));

  return parsed.length > 0 ? parsed : DEFAULT_CHANNELS;
}

export function bridgeWhatsAppGroupName(): string {
  return (
    process.env.TG_WA_WHATSAPP_GROUP_NAME ||
    process.env.BRIDGE_WHATSAPP_GROUP_NAME ||
    DEFAULT_WHATSAPP_GROUP_NAME
  ).trim();
}

/** Default: דיווחים מבצעי איראן 🇮🇷 */
const DEFAULT_WHATSAPP_CHAT_ID = "120363409236894886@g.us";

export function bridgeWhatsAppChatId(): string {
  return (
    process.env.TG_WA_WHATSAPP_CHAT_ID ||
    process.env.BRIDGE_WHATSAPP_CHAT_ID ||
    process.env.WHATSAPP_GROUP_CHAT_ID ||
    process.env.MISSILE_WHATSAPP_CHAT_ID ||
    DEFAULT_WHATSAPP_CHAT_ID
  ).trim();
}

export function isBridgeEnabled(): boolean {
  const flag = (process.env.TG_WA_BRIDGE_ENABLED ?? "true").trim().toLowerCase();
  return flag !== "0" && flag !== "false" && flag !== "off";
}

/** Normalize for fuzzy group-name match (strip emoji / extra spaces). */
export function normalizeGroupName(name: string): string {
  return name
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
