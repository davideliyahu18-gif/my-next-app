import type { AlertArea, LatLng } from "./types";

/**
 * Approximate Israeli alert areas with published-style shelter entry times
 * (זמן למרחב מוגן). These are illustrative public reference values for the
 * OSINT dashboard — not an official Home Front Command feed.
 */
export const ALERT_AREAS: AlertArea[] = [
  {
    id: "tel-aviv",
    labelHe: "תל אביב",
    regionHe: "מרכז",
    aliases: ["תל אביב", "ת״א", "ת'א", "גוש דן", "תל-אביב"],
    position: { lat: 32.0853, lng: 34.7818 },
    shelterSeconds: 90,
  },
  {
    id: "gush-dan",
    labelHe: "גוש דן",
    regionHe: "מרכז",
    aliases: ["חולון", "בת ים", "רמת גן", "גבעתיים", "בני ברק", "פתח תקווה"],
    position: { lat: 32.07, lng: 34.8 },
    shelterSeconds: 90,
  },
  {
    id: "sharon",
    labelHe: "השרון",
    regionHe: "מרכז",
    aliases: ["השרון", "נתניה", "הרצליה", "רעננה", "כפר סבא", "הוד השרון"],
    position: { lat: 32.3, lng: 34.88 },
    shelterSeconds: 90,
  },
  {
    id: "jerusalem",
    labelHe: "ירושלים",
    regionHe: "מרכז",
    aliases: ["ירושלים", "ירושלם"],
    position: { lat: 31.7683, lng: 35.2137 },
    shelterSeconds: 90,
  },
  {
    id: "center",
    labelHe: "מרכז",
    regionHe: "מרכז",
    aliases: ["מרכז", "למרכז", "לעבר המרכז"],
    position: { lat: 32.1, lng: 34.9 },
    shelterSeconds: 90,
  },
  {
    id: "haifa",
    labelHe: "חיפה",
    regionHe: "צפון",
    aliases: ["חיפה", "קריות", "נשר"],
    position: { lat: 32.794, lng: 34.9896 },
    shelterSeconds: 60,
  },
  {
    id: "north",
    labelHe: "צפון",
    regionHe: "צפון",
    aliases: ["צפון", "לצפון", "לעבר הצפון"],
    position: { lat: 33.0, lng: 35.5 },
    shelterSeconds: 60,
  },
  {
    id: "galil",
    labelHe: "גליל",
    regionHe: "צפון",
    aliases: ["גליל", "צפת", "נהריה", "עכו", "כרמיאל", "טבריה"],
    position: { lat: 32.97, lng: 35.5 },
    shelterSeconds: 30,
  },
  {
    id: "golan",
    labelHe: "גולן",
    regionHe: "צפון",
    aliases: ["גולן", "קריית שמונה", "מטולה"],
    position: { lat: 33.15, lng: 35.7 },
    shelterSeconds: 15,
  },
  {
    id: "ashdod",
    labelHe: "אשדוד",
    regionHe: "דרום",
    aliases: ["אשדוד"],
    position: { lat: 31.8044, lng: 34.6553 },
    shelterSeconds: 45,
  },
  {
    id: "ashkelon",
    labelHe: "אשקלון",
    regionHe: "דרום",
    aliases: ["אשקלון"],
    position: { lat: 31.6688, lng: 34.5743 },
    shelterSeconds: 30,
  },
  {
    id: "beer-sheva",
    labelHe: "באר שבע",
    regionHe: "דרום",
    aliases: ["באר שבע", "באר-שבע", "ב״ש", "ב'ש"],
    position: { lat: 31.253, lng: 34.7915 },
    shelterSeconds: 60,
  },
  {
    id: "gaza-envelope",
    labelHe: "עוטף עזה",
    regionHe: "דרום",
    aliases: ["עוטף", "שדרות", "נתיבות", "אופקים", "כיסופים", "ניר עוז"],
    position: { lat: 31.45, lng: 34.55 },
    shelterSeconds: 15,
  },
  {
    id: "south",
    labelHe: "דרום",
    regionHe: "דרום",
    aliases: ["דרום", "לדרום", "לעבר הדרום"],
    position: { lat: 31.25, lng: 34.8 },
    shelterSeconds: 45,
  },
  {
    id: "eilat",
    labelHe: "אילת",
    regionHe: "דרום",
    aliases: ["אילת"],
    position: { lat: 29.5577, lng: 34.9519 },
    shelterSeconds: 180,
  },
  {
    id: "israel",
    labelHe: "ישראל (כללי)",
    regionHe: "ארצי",
    aliases: ["ישראל", "לעבר ישראל", "לכל הארץ"],
    position: { lat: 31.5, lng: 34.85 },
    shelterSeconds: 90,
  },
];

/** Prefer city-level matches over broad regional buckets. */
const SPECIFICITY: Record<string, number> = {
  "gaza-envelope": 5,
  ashdod: 5,
  ashkelon: 5,
  "beer-sheva": 5,
  eilat: 5,
  "tel-aviv": 5,
  "gush-dan": 4,
  sharon: 4,
  jerusalem: 5,
  haifa: 5,
  galil: 4,
  golan: 4,
  south: 2,
  center: 2,
  north: 2,
  israel: 1,
};

function normalize(text: string): string {
  return text.replace(/\u200f|\u200e/g, "").toLowerCase();
}

export function matchAlertAreas(text: string): AlertArea[] {
  const normalized = normalize(text);
  const found: AlertArea[] = [];
  for (const area of ALERT_AREAS) {
    const hit = area.aliases.some((alias) =>
      normalized.includes(alias.toLowerCase()),
    );
    if (hit && !found.some((a) => a.id === area.id)) {
      found.push(area);
    }
  }
  return found.sort(
    (a, b) => (SPECIFICITY[b.id] ?? 0) - (SPECIFICITY[a.id] ?? 0),
  );
}

export function resolveAlertAreas(text: string): AlertArea[] {
  const matched = matchAlertAreas(text).filter((a) => a.id !== "israel");
  if (matched.length > 0) {
    // Keep specific cities; drop parent region if a city in that region matched.
    const specific = matched.filter((a) => (SPECIFICITY[a.id] ?? 0) >= 4);
    if (specific.length > 0) return specific.slice(0, 4);
    return matched.slice(0, 3);
  }
  if (/ירדן|עקבה|כווית|בחריין/.test(text)) return [];
  return [ALERT_AREAS.find((a) => a.id === "israel")!];
}

export function primaryAlertArea(text: string): AlertArea | null {
  return resolveAlertAreas(text)[0] ?? null;
}

export function shelterSecondsForAreas(areas: AlertArea[]): number | null {
  if (areas.length === 0) return null;
  return Math.min(...areas.map((a) => a.shelterSeconds));
}

export function formatShelterSeconds(seconds: number): string {
  if (seconds <= 0) return "מיידי";
  if (seconds < 60) return `${seconds} שניות`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (rem === 0) return mins === 1 ? "דקה" : `${mins} דקות`;
  return `${mins}:${String(rem).padStart(2, "0")} דק׳`;
}

export function areaMapPath(areaId: string): string {
  return `/rockets?area=${encodeURIComponent(areaId)}`;
}

export function siteBaseUrl(): string {
  const explicit =
    process.env.WEBSITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEBSITE_FEED_URL?.replace(/\/api\/feed\/?$/, "") ||
    "";
  if (explicit.trim()) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "";
}

export function areaMapUrl(areaId: string): string {
  const base = siteBaseUrl();
  const path = areaMapPath(areaId);
  return base ? `${base}${path}` : path;
}

export function targetFromAreas(areas: AlertArea[]): {
  position: LatLng;
  labelHe: string;
} | null {
  if (areas.length === 0) return null;
  const primary = areas[0];
  const labelHe =
    areas.length === 1
      ? primary.labelHe
      : areas.map((a) => a.labelHe).join(", ");
  return { position: primary.position, labelHe };
}
