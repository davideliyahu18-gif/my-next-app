import type { NavLinkView } from "./types";

/** Max messages returned on initial load / reconnect. */
export const WHATSAPP_FEED_INITIAL_LIMIT = 50;

/** Shared secret for POST /api/feed (set on Vercel + bot). */
export const FEED_API_SECRET = process.env.FEED_API_SECRET ?? "";

/** FIFA API configuration (https://api.fifa.com/api/v3). */
export const FIFA_CONFIG = {
  baseUrl: process.env.FIFA_API_BASE_URL ?? "https://api.fifa.com/api/v3",
  language: process.env.FIFA_API_LANGUAGE ?? "en",
  idCompetition: process.env.FIFA_ID_COMPETITION ?? "17",
  idSeason: process.env.FIFA_ID_SEASON ?? "",
  matchCount: Number(process.env.FIFA_MATCH_COUNT ?? "500"),
  enableHebrewTeamNames: process.env.ENABLE_HEBREW_TEAM_NAMES !== "false",
  enableTeamFlags: process.env.ENABLE_TEAM_FLAGS !== "false",
  revalidateSeconds: Number(process.env.FIFA_REVALIDATE_SECONDS ?? "30"),
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

/** Cache TTL for live FIFA data (seconds). */
export const LIVE_DATA_REVALIDATE_SECONDS = 30;
