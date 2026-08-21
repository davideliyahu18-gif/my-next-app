import type { BridgeChannelConfig } from "./types";

/** Default: https://t.me/newsil5 — label kept neutral (do not expose מודיעין גלוי). */
const DEFAULT_CHANNELS: BridgeChannelConfig[] = [
  {
    username: "newsil5",
    label: "ערוץ מקור",
  },
];

/** WhatsApp group: חמ״ל only. */
export const DEFAULT_WHATSAPP_GROUP_NAME = "חמ״ל התרעות ירי איראן 🛡️";

/**
 * Channels to forward.
 * Format: username or username:Label, comma-separated.
 * Default: newsil5
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

/** Default target: חמ״ל התרעות ירי איראן 🛡️ only */
export const DEFAULT_HAMAL_WHATSAPP_CHAT_ID = "120363410746391414@g.us";
export const DEFAULT_HAMAL_WHATSAPP_GROUP_NAME = "חמ״ל התרעות ירי איראן 🛡️";
const DEFAULT_WHATSAPP_CHAT_ID = DEFAULT_HAMAL_WHATSAPP_CHAT_ID;

export function bridgeWhatsAppChatId(): string {
  return (
    process.env.TG_WA_WHATSAPP_CHAT_ID ||
    process.env.BRIDGE_WHATSAPP_CHAT_ID ||
    process.env.WHATSAPP_GROUP_CHAT_ID ||
    process.env.MISSILE_WHATSAPP_CHAT_ID ||
    process.env.TG_WA_HAMAL_CHAT_ID ||
    process.env.ROCKETS_WHATSAPP_CHAT_ID ||
    DEFAULT_WHATSAPP_CHAT_ID
  ).trim();
}

/**
 * WhatsApp group chat ids to receive forwards.
 * Default: חמ״ל only (no דיווחים / מודיעין גלוי group).
 * Env: TG_WA_WHATSAPP_CHAT_IDS=id@g.us
 */
export function bridgeWhatsAppChatIds(): string[] {
  const raw = (
    process.env.TG_WA_WHATSAPP_CHAT_IDS ||
    process.env.BRIDGE_WHATSAPP_CHAT_IDS ||
    ""
  ).trim();

  const ids: string[] = [];
  const push = (id: string) => {
    const cleaned = id.trim();
    if (!cleaned) return;
    if (!ids.includes(cleaned)) ids.push(cleaned);
  };

  if (raw) {
    for (const part of raw.split(",")) push(part);
  } else {
    push(bridgeWhatsAppChatId());
  }

  return ids.filter((id) => id.endsWith("@g.us") || id.endsWith("@c.us"));
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
