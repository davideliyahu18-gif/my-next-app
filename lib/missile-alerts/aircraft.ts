import { matchPlaces } from "@/lib/rockets/locations";
import type { TelegramChannelMessage } from "@/lib/rockets/telegram";
import { boldEveryLine } from "./style";
import type { MissileAlert } from "./types";

type PlaceHit = { label: string; lat: number; lng: number };

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

function field(text: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escaped}\\s*[|:\\-–]\\s*([^\\n]+)`, "i"),
    new RegExp(`${escaped}\\s*:\\s*([^\\n]+)`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function isFighterJetInIranMessage(text: string): boolean {
  const hasIran = /איראן|ايران|إيران|iran|טהרן|אספהאן|כרמאנשאה|בושהר|שיראז|המדאן|תבריז|tehran|isfahan|kermanshah/i.test(
    text,
  );
  if (!hasIran) return false;

  return (
    /מטוס(?:י)?\s*קרב|מטוסי\s*קרב|חיל\s*האוויר|חיל\s*אוויר|F-?35|F-?16|F-?15|F-?18|בסיס\s*אווירי|פעילות\s*אווירית|מטוסים\s*(?:מעל|ב|באיראן)|fighter\s*jet|combat\s*aircraft|warplane|warplanes|fighter\s*aircraft|air\s*force\s*(?:jets?|aircraft)|jets?\s+over\s+iran/i.test(
      text,
    ) ||
    (/מטוס|מטוסים|טיסה|טיסות|aircraft|jets?/.test(text) &&
      /קרב|תקיפה|חדירה|מעל איראן|בשמי איראן|מרחב אווירי|strike|over\s+iran|iranian\s+airspace/i.test(
        text,
      ))
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

function placeFromLabel(label: string): PlaceHit | null {
  const places = matchPlaces(label);
  if (!places[0]) return null;
  return {
    label: places[0].labelHe,
    lat: places[0].position.lat,
    lng: places[0].position.lng,
  };
}

function pickCurrentArea(text: string): PlaceHit {
  const overMatch =
    text.match(/מעל\s+([^\n,·|]+)/i)?.[1] ??
    text.match(/בשמי\s+([^\n,·|]+)/i)?.[1] ??
    text.match(/באזור\s+([^\n,·|]+)/i)?.[1] ??
    field(text, "מיקום") ??
    field(text, "אזור") ??
    null;

  if (overMatch) {
    const hit = placeFromLabel(overMatch) ?? placeFromLabel(text);
    if (hit) return hit;
    return { label: overMatch.trim().slice(0, 40), lat: 32.5, lng: 53.0 };
  }

  const launches = matchPlaces(text, "launch");
  if (launches[0]) {
    return {
      label: launches[0].labelHe,
      lat: launches[0].position.lat,
      lng: launches[0].position.lng,
    };
  }
  return { label: "איראן (כללי)", lat: 32.5, lng: 53.0 };
}

function pickDestination(text: string): PlaceHit | null {
  const destField =
    field(text, "יעד") ??
    field(text, "כיוון") ??
    field(text, "לאן") ??
    field(text, "יעד משוער") ??
    text.match(/לעבר\s+([^\n,·|]+)/i)?.[1] ??
    text.match(/לכיוון\s+([^\n,·|]+)/i)?.[1] ??
    text.match(/בדרך\s+ל([^\n,·|]+)/i)?.[1] ??
    text.match(/מכוון(?:ים)?\s+ל([^\n,·|]+)/i)?.[1] ??
    null;

  if (destField) {
    const hit = placeFromLabel(destField);
    if (hit) return hit;
    return { label: destField.trim().slice(0, 40), lat: 29.3759, lng: 47.9774 };
  }

  // Explicit target places in text (Kuwait / Israel / Gulf) that aren't only the over-flight area.
  const targets = matchPlaces(text, "target");
  if (targets[0]) {
    return {
      label: targets[0].labelHe,
      lat: targets[0].position.lat,
      lng: targets[0].position.lng,
    };
  }
  return null;
}

function parseArrival(
  text: string,
  reportedAt: Date,
): { label: string; etaSeconds: number | null } {
  const etaField =
    field(text, "צפי הגעה") ??
    field(text, "הגעה") ??
    field(text, "מתי") ??
    text.match(/צפי הגעה[^0-9]*(\d{1,2}:\d{2}(?::\d{2})?)/)?.[1] ??
    text.match(/מגיע(?:ים)?\s*(?:ב|בשעה)?\s*(\d{1,2}:\d{2}(?::\d{2})?)/)?.[1] ??
    null;

  const inMinutes = text.match(/בעוד\s+(\d+)\s*(?:דק|דקות|min)/i);
  if (inMinutes) {
    const mins = Number(inMinutes[1]);
    const arrive = new Date(reportedAt.getTime() + mins * 60_000);
    return {
      label: `בעוד ${mins} דק׳ · ${formatClock(arrive.toISOString())}`,
      etaSeconds: mins * 60,
    };
  }

  if (etaField) {
    const timeMatch = String(etaField).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      const seconds = Number(timeMatch[3] ?? "0");
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuwait",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(reportedAt);
      const asUtc = Date.parse(
        `${day}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}+03:00`,
      );
      if (!Number.isNaN(asUtc)) {
        const etaSeconds = Math.round((asUtc - reportedAt.getTime()) / 1000);
        const clock = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}${timeMatch[3] ? `:${String(seconds).padStart(2, "0")}` : ""}`;
        if (etaSeconds >= 0) {
          const m = Math.floor(etaSeconds / 60);
          return {
            label: `${clock} (שעון כווית) · בעוד ${m} דק׳`,
            etaSeconds,
          };
        }
        return { label: `${clock} (שעון כווית)`, etaSeconds: 0 };
      }
    }
    return { label: String(etaField).trim(), etaSeconds: null };
  }

  return { label: "לא צוין בדיווח — נעדכן כשיהיה צפי", etaSeconds: null };
}

export function messageToAircraftAlert(
  message: TelegramChannelMessage,
  now = new Date(),
): MissileAlert | null {
  if (!isFighterJetInIranMessage(message.text)) return null;

  const reportedAt = new Date(
    Number.isNaN(Date.parse(message.datetime))
      ? now.toISOString()
      : message.datetime,
  );
  const kind = aircraftKind(message.text);
  const current = pickCurrentArea(message.text);
  const destination = pickDestination(message.text);
  const arrival = parseArrival(message.text, reportedAt);
  const pin = destination ?? current;
  const maps = mapsUrl(pin.lat, pin.lng);
  const snippet = message.text.replace(/\s+/g, " ").trim().slice(0, 180);

  const lines = [
    "✈️ התראת מטוסי קרב · איראן",
    "",
    `🧭 סוג: ${kind}`,
    `🕐 זוהו: ${formatClock(reportedAt.toISOString())} (שעון כווית)`,
    `📍 נמצאים כעת: ${current.label}`,
    `🎯 לאן: ${destination ? destination.label : "לא צוין בדיווח"}`,
    `⏱ מתי מגיעים: ${arrival.label}`,
    "",
    `דיווח: ${snippet}`,
    "",
    `🗺 מפה (${destination ? "יעד" : "מיקום נוכחי"}): ${maps}`,
    `מקור: @${message.channel}`,
    ...(message.url ? [message.url] : []),
    "",
    "מיקום/זמנים לפי דיווח פומבי — לא טלמטריה צבאית מדויקת",
  ];

  return {
    id: `air-${message.id}`,
    text: boldEveryLine(lines.join("\n")),
    originLabelHe: current.label,
    targetLabelHe: destination?.label ?? "לא צוין",
    origin: { lat: current.lat, lng: current.lng },
    target: { lat: pin.lat, lng: pin.lng },
    location: {
      latitude: pin.lat,
      longitude: pin.lng,
      name: destination
        ? `יעד מטוסי קרב · ${destination.label}`
        : `מטוסי קרב · ${current.label}`,
      address: destination
        ? `יעד משוער · ${destination.label}`
        : `מיקום נוכחי משוער · ${current.label}`,
    },
    launchLocation: {
      latitude: current.lat,
      longitude: current.lng,
      name: `נמצאים כעת · ${current.label}`,
      address: `מיקום נוכחי משוער · ${current.label}`,
    },
    launchedAt: reportedAt.toISOString(),
    etaSeconds: arrival.etaSeconds ?? 0,
    weaponHe: kind,
    sourceHe: `@${message.channel}`,
    sourceUrl: message.url || undefined,
    mapsUrl: maps,
  };
}

export function messagesToAircraftAlerts(
  messages: TelegramChannelMessage[],
  now = new Date(),
): MissileAlert[] {
  const alerts: MissileAlert[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    const alert = messageToAircraftAlert(message, now);
    if (!alert || seen.has(alert.id)) continue;
    seen.add(alert.id);
    alerts.push(alert);
  }
  return alerts;
}

export function createDemoAircraftAlert(now = new Date()): MissileAlert {
  return messageToAircraftAlert(
    {
      id: `demo-air-${now.getTime()}`,
      channel: "demo",
      url: "",
      text: "ראשוני: מטוסי קרב זוהו מעל כרמאנשאה לעבר כווית · צפי הגעה 23:45",
      datetime: now.toISOString(),
    },
    now,
  )!;
}
