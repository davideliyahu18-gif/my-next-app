import type { BridgeChannelConfig } from "./types";

/**
 * Channels to forward.
 * Format: username or username:Label, comma-separated.
 * Example: newsil5:מודיעין גלוי,shigurimisrael
 */
export function getBridgeChannels(): BridgeChannelConfig[] {
  const raw = (
    process.env.TG_WA_CHANNELS ||
    process.env.TELEGRAM_BRIDGE_CHANNELS ||
    ""
  ).trim();

  if (!raw) return [];

  return raw
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
}

export function bridgeWhatsAppChatId(): string {
  return (
    process.env.TG_WA_WHATSAPP_CHAT_ID ||
    process.env.BRIDGE_WHATSAPP_CHAT_ID ||
    process.env.WHATSAPP_GROUP_CHAT_ID ||
    process.env.MISSILE_WHATSAPP_CHAT_ID ||
    ""
  ).trim();
}

export function isBridgeEnabled(): boolean {
  const flag = (process.env.TG_WA_BRIDGE_ENABLED ?? "true").trim().toLowerCase();
  return flag !== "0" && flag !== "false" && flag !== "off";
}
