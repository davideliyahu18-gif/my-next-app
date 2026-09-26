/** "off" = source intentionally has no live backend (e.g. Oref, for which no
 * official public API exists) — distinct from "down", a real failure of a
 * source that should otherwise be working. */
export type ConnectionState = "connected" | "degraded" | "down" | "off";

export type SourceConnections = {
  aircraft: ConnectionState;
  bgn: ConnectionState;
  weather: ConnectionState;
  alerts: ConnectionState;
};

export type NavSection =
  | "map"
  | "departures"
  | "arrivals"
  | "byDate"
  | "search"
  | "aircraft"
  | "weather"
  | "alerts";

export const NAV_ITEMS: { id: NavSection; label: string; emoji: string }[] = [
  { id: "map", label: "מפה חיה", emoji: "🌐" },
  { id: "departures", label: "המראות", emoji: "🛫" },
  { id: "arrivals", label: "נחיתות", emoji: "🛬" },
  { id: "byDate", label: "טיסות לפי תאריך", emoji: "📅" },
  { id: "search", label: "חיפוש טיסה", emoji: "🔍" },
  { id: "aircraft", label: "מטוסים מסביב", emoji: "🎯" },
  { id: "weather", label: "מזג אוויר", emoji: "☁️" },
  { id: "alerts", label: "התרעות", emoji: "🔔" },
];
