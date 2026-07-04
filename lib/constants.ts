import type { NavLinkView } from "./types";

/** Path to the FIFA WhatsApp bot (uses football_api.py). */
export const FOOTBALL_BOT_PATH =
  process.env.FOOTBALL_BOT_PATH ??
  `${process.env.HOME ?? ""}/fifa-whatsapp-bot`;

/** JSONL feed written by the WhatsApp bot on every outbound message. */
export const WEBSITE_FEED_PATH =
  process.env.WEBSITE_FEED_PATH ??
  `${FOOTBALL_BOT_PATH}/data/website_feed.jsonl`;

/** Max messages returned on initial load / reconnect. */
export const WHATSAPP_FEED_INITIAL_LIMIT = 50;

/** Placeholder for future direct HTTP access to the same FIFA endpoints. */
export const API_CONFIG = {
  baseUrl: process.env.FIFA_API_BASE_URL ?? "https://api.fifa.com/api/v3",
  apiKey: process.env.FOOTBALL_API_KEY ?? "",
  timeoutMs: 10_000,
} as const;

export const TOURNAMENT_ID = "fifa-world-cup-2026";

export const IMAGES = {
  stadium:
    "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=2400&q=85",
  trophy:
    "https://images.unsplash.com/photo-1574629810360-7efbc16732a0?w=800&q=90",
} as const;

export const NAV_LINKS: NavLinkView[] = [
  { href: "#matches", label: "משחקים" },
  { href: "#news", label: "עדכונים" },
  { href: "#standings", label: "בתים" },
  { href: "#scorers", label: "מבקיעים" },
  { href: "#stats", label: "סטטיסטיקה" },
];

export const TOURNAMENT_META = {
  dateRange: "11 יוני – 19 יולי 2026",
  tagline: "ארה״ב · קאנדה · מקסיקו — ההיסטוריה הגדולה ביותר בכדורגל",
  footerHosts: "ארה״ב · קאנדה · מקסיקו",
} as const;

/** Cache TTL for live bot data (seconds). */
export const LIVE_DATA_REVALIDATE_SECONDS = 30;
