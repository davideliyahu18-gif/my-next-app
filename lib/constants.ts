import type { NavLinkView } from "./types";

/** Max messages returned on initial load / reconnect. */
export const WHATSAPP_FEED_INITIAL_LIMIT = 50;

/** Shared secret for POST /api/feed (set on Vercel + bot). */
export const FEED_API_SECRET = process.env.FEED_API_SECRET ?? "";

/** WhatsApp group invite for live football alerts. */
export const WHATSAPP_INVITE_LINK =
  process.env.WHATSAPP_INVITE_LINK ||
  process.env.NEXT_PUBLIC_WHATSAPP_INVITE_LINK ||
  "https://chat.whatsapp.com/BhEThcue1kmE8pgUxtpmma";

export const WHATSAPP_GROUP_NAME =
  process.env.WHATSAPP_GROUP_NAME ||
  process.env.NEXT_PUBLIC_WHATSAPP_GROUP_NAME ||
  "כדורגל בזמן אמת";

export const WHATSAPP_GROUP_CAPTION =
  process.env.WHATSAPP_GROUP_CAPTION ||
  `קישור לקבוצת WhatsApp · ${WHATSAPP_GROUP_NAME}`;

/** WhatsApp group for rocket / חמ״ל התרעות איראן alerts. */
export const ROCKETS_WHATSAPP_INVITE_LINK =
  process.env.ROCKETS_WHATSAPP_INVITE_LINK ||
  process.env.NEXT_PUBLIC_ROCKETS_WHATSAPP_INVITE_LINK ||
  "https://chat.whatsapp.com/DgafURRfpIqD2mLd3xLwf5";

export const ROCKETS_WHATSAPP_GROUP_NAME =
  process.env.ROCKETS_WHATSAPP_GROUP_NAME ||
  process.env.MISSILE_WHATSAPP_GROUP_NAME ||
  "חמ״ל התרעות איראן";

/** FIFA API configuration (https://api.fifa.com/api/v3). */
export const FIFA_CONFIG = {
  baseUrl: process.env.FIFA_API_BASE_URL ?? "https://api.fifa.com/api/v3",
  language: process.env.FIFA_API_LANGUAGE ?? "en",
  idCompetition: process.env.FIFA_ID_COMPETITION ?? "17",
  idSeason: process.env.FIFA_ID_SEASON ?? "285023",
  idStage: process.env.FIFA_ID_STAGE ?? "289273",
  matchCount: Number(process.env.FIFA_MATCH_COUNT ?? "500"),
  enableHebrewTeamNames: process.env.ENABLE_HEBREW_TEAM_NAMES !== "false",
  enableTeamFlags: process.env.ENABLE_TEAM_FLAGS !== "false",
  revalidateSeconds: Number(process.env.FIFA_REVALIDATE_SECONDS ?? "30"),
} as const;

export const TOURNAMENT_ID = "fifa-world-cup-2026";

/** Public site brand — web now, app later. */
export const SITE_BRAND = {
  name: "כדורגל בזמן אמת",
  nameWithEmoji: "כדורגל בזמן אמת ⚽",
  shortName: "בזמן אמת",
  eyebrow: "REAL-TIME FOOTBALL",
  tagline: "משחקים, טבלאות וליגת האלופות — בזמן אמת",
  description:
    "כדורגל בזמן אמת ⚽ — לוח משחקים, טבלאות וליגת האלופות. אתר עכשיו, אפליקציה בהמשך.",
} as const;

export const IMAGES = {
  stadium:
    "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=2400&q=85",
  trophy: "/images/world-cup-trophy.jpg",
} as const;

export const NAV_LINKS: NavLinkView[] = [
  { href: "#home", label: "ראשי" },
  { href: "/today", label: "משחקי היום" },
  { href: "/widget", label: "ווידג׳ט" },
  { href: "#matches", label: "משחקים" },
  { href: "#standings", label: "טבלאות" },
  { href: "#ucl", label: "ליגת האלופות" },
  { href: "/watch", label: "איפה לצפות" },
  { href: "#news", label: "חדשות" },
];

export const TOURNAMENT_META = {
  dateRange: "11 יוני – 19 יולי 2026",
  startDate: "2026-06-11",
  endDate: "2026-07-19",
  tagline: "ארה״ב · קאנדה · מקסיקו — ההיסטוריה הגדולה ביותר בכדורגל",
  footerHosts: "ארה״ב · קאנדה · מקסיקו",
} as const;

/** Cache TTL for FIFA page data served from SSR (seconds). */
export const LIVE_DATA_REVALIDATE_SECONDS = 15;

/** Client poll interval for live FIFA dashboard (milliseconds). */
export const FIFA_LIVE_POLL_MS = 15_000;
