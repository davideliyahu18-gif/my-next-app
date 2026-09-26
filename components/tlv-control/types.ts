export type ConnectionState = "connected" | "degraded" | "down";

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
