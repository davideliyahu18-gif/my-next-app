import { matchPlaces } from "@/lib/rockets/locations";
import type { TelegramChannelMessage } from "@/lib/rockets/telegram";
import { boldEveryLine } from "./style";
import type { MissileAlert } from "./types";

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Kuwait",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    hour12: false,
  }).format(date);
}

function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function isFighterJetInIranMessage(text: string): boolean {
  const hasIran = /איראן|ايران|إيران|iran|טהרן|אספהאן|כרמאנשאה|בושהר|שיראז/i.test(
    text,
  );
  if (!hasIran) return false;

  return (
    /מטוס(?:י)?\s*קרב|מטוסי\s*קרב|חיל\s*האוויר|חיל\s*אוויר|F-?35|F-?16|F-?15|F-?18|בסיס\s*אווירי|פעילות\s*אווירית|מטוסים\s*(?:מעל|ב|באיראן)|fighter\s*jet|combat\s*aircraft|warplane/i.test(
      text,
    ) ||
    (/מטוס|מטוסים|טיסה|טיסות/.test(text) &&
      /קרב|תקיפה|חדירה|מעל איראן|בשמי איראן|מרחב אווירי/.test(text))
  );
}

function aircraftKind(text: string): string {
  if (/F-?35/i.test(text)) return "F-35";
  if (/F-?16/i.test(text)) return "F-16";
  if (/F-?15/i.test(text)) return "F-15";
  if (/מטוסי\s*קרב|מטוס(?:י)?\s*קרב|fighter/i.test(text)) return "מטוסי קרב";
  if (/חיל\s*האוויר|חיל\s*אוויר/i.test(text)) return "חיל האוויר";
  return "פעילות אווירית";
}

function pickIranArea(text: string): { label: string; lat: number; lng: number } {
  const places = matchPlaces(text, "launch");
  if (places[0]) {
    return {
      label: places[0].labelHe,
      lat: places[0].position.lat,
      lng: places[0].position.lng,
    };
  }
  return { label: "איראן (כללי)", lat: 32.5, lng: 53.0 };
}

export function messageToAircraftAlert(
  message: TelegramChannelMessage,
): MissileAlert | null {
  if (!isFighterJetInIranMessage(message.text)) return null;

  const area = pickIranArea(message.text);
  const kind = aircraftKind(message.text);
  const snippet = message.text.replace(/\s+/g, " ").trim().slice(0, 180);
  const maps = mapsUrl(area.lat, area.lng);

  const lines = [
    "✈️ התראת מטוסי קרב · איראן",
    "",
    `סוג: ${kind}`,
    `אזור (משוער): ${area.label}`,
    `שעה: ${formatClock(message.datetime)} (שעון כווית)`,
    "",
    `דיווח: ${snippet}`,
    "",
    `מפה: ${maps}`,
    `מקור: @${message.channel}`,
    message.url,
    "",
    "מיקום מקורב לפי דיווח פומבי/OSINT",
  ];

  return {
    id: `air-${message.id}`,
    text: boldEveryLine(lines.join("\n")),
    originLabelHe: area.label,
    targetLabelHe: "איראן",
    origin: { lat: area.lat, lng: area.lng },
    target: { lat: area.lat, lng: area.lng },
    location: {
      latitude: area.lat,
      longitude: area.lng,
      name: `מטוסי קרב · ${area.label}`,
      address: `פעילות אווירית משוערת · ${area.label}`,
    },
    launchedAt: message.datetime,
    etaSeconds: 0,
    weaponHe: kind,
    sourceHe: `@${message.channel}`,
    sourceUrl: message.url,
    mapsUrl: maps,
  };
}

export function messagesToAircraftAlerts(
  messages: TelegramChannelMessage[],
): MissileAlert[] {
  const alerts: MissileAlert[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    const alert = messageToAircraftAlert(message);
    if (!alert || seen.has(alert.id)) continue;
    seen.add(alert.id);
    alerts.push(alert);
  }
  return alerts;
}

export function createDemoAircraftAlert(now = new Date()): MissileAlert {
  return messageToAircraftAlert({
    id: `demo-air-${now.getTime()}`,
    channel: "demo",
    url: "",
    text: "ראשוני: מטוסי קרב זוהו מעל איראן · אזור אספהאן",
    datetime: now.toISOString(),
  })!;
}
