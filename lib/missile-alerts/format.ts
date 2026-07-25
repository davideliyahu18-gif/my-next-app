import {
  KUWAIT_DEFAULT_TARGET,
  firstGulfTarget,
  mentionsGulf,
  mentionsKuwait,
} from "@/lib/rockets/locations";
import { messageToTrack } from "@/lib/rockets/parse-alert";
import type { TelegramChannelMessage } from "@/lib/rockets/telegram";
import type { RocketTrack } from "@/lib/rockets/types";
import { messagesToAircraftAlerts } from "./aircraft";
import { boldEveryLine } from "./style";
import type { MissileAlert, MissileAlertLocation } from "./types";

function regionalMode(): boolean {
  // Default ON for "מרכז התרעות אזורי" — Kuwait + Gulf.
  return (process.env.MISSILE_ALERT_REGIONAL_GULF ?? "true") !== "false";
}

function remapIranLaunchesToKuwait(): boolean {
  return (process.env.MISSILE_ALERT_REMAP_IRAN_LAUNCHES ?? "false") === "true";
}

function onlyExplicitTarget(): boolean {
  if (remapIranLaunchesToKuwait()) return false;
  // In regional mode, require an explicit Gulf/Kuwait mention (not Israel-only).
  return (process.env.MISSILE_ALERT_REQUIRE_KUWAIT_MENTION ?? "true") !== "false";
}

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

function etaLabel(seconds: number): string {
  if (seconds <= 0) return "לא ידוע / קרוב";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function toLocation(
  label: string,
  lat: number,
  lng: number,
  kind: "target" | "launch",
): MissileAlertLocation {
  return {
    latitude: lat,
    longitude: lng,
    name: label,
    address:
      kind === "target"
        ? `אזור יעד משוער · ${label}`
        : `אזור שיגור משוער · ${label}`,
  };
}

export function formatMissileAlertText(alert: Omit<MissileAlert, "text">): string {
  const lines = [
    `🚨 התראת שיגור · איראן → ${alert.targetLabelHe}`,
    "",
    `📍 משגר (משוער): ${alert.originLabelHe}`,
    `🎯 יעד (משוער): ${alert.targetLabelHe}`,
    `🧭 סוג: ${alert.weaponHe}`,
    `🕐 שיגור: ${formatClock(alert.launchedAt)} (שעון כווית)`,
    `⏱ צפי הגעה: ${etaLabel(alert.etaSeconds)}`,
    "",
    `🗺 מפה: ${alert.mapsUrl}`,
    `מקור: ${alert.sourceHe}`,
    ...(alert.sourceUrl ? [alert.sourceUrl] : []),
    "",
    "⚠️ מיקום מקורב לפי דיווח פומבי/OSINT — לא קואורדינטה צבאית מדויקת.",
  ];
  return boldEveryLine(lines.join("\n"));
}

export function trackToMissileAlert(track: RocketTrack): MissileAlert {
  const location = toLocation(
    track.targetLabelHe,
    track.target.lat,
    track.target.lng,
    "target",
  );
  const base = {
    id: track.id,
    originLabelHe: track.originLabelHe,
    targetLabelHe: track.targetLabelHe,
    origin: track.origin,
    target: track.target,
    location,
    launchLocation: toLocation(
      track.originLabelHe,
      track.origin.lat,
      track.origin.lng,
      "launch",
    ),
    launchedAt: track.launchedAt,
    etaSeconds: track.etaSeconds,
    weaponHe: track.speedHintHe,
    sourceHe: track.sourceHe,
    sourceUrl: track.sourceUrl,
    mapsUrl: mapsUrl(track.target.lat, track.target.lng),
  };
  return { ...base, text: formatMissileAlertText(base) };
}

function isIranOriginTrack(track: RocketTrack, text: string): boolean {
  if (/איראן|ايران|إيران|iran/i.test(text)) return true;
  if (/איראן|ايران/.test(track.labelHe)) return true;
  return /כרמאנשאה|אספהאן|שיראז|תבריז|בושהר|טהרן|המדאן|זנג|יזד|בידגנה/.test(
    track.originLabelHe,
  );
}

function isRegionalRelevant(track: RocketTrack, text: string): boolean {
  if (mentionsGulf(text) || mentionsKuwait(text)) return true;
  if (/כווית|בחריין|קטאר|אמירויות|סעודיה|kuwait|bahrain|qatar|uae|saudi/i.test(
    track.targetLabelHe,
  )) {
    return true;
  }
  if (onlyExplicitTarget()) return false;
  return remapIranLaunchesToKuwait() && isIranOriginTrack(track, text);
}

function isGulfStrikeMessage(text: string): boolean {
  if (!regionalMode()) return false;

  // Ignore outbound coalition strikes INTO Yemen (not alerts for the Gulf).
  if (
    /סעודיה תקפה|saudi\s+arabia\s+bombed|bombed\s+the\s+port\s+of\s+hodeidah/i.test(
      text,
    )
  ) {
    return false;
  }

  // Saudi / ARAMCO / Gulf airbases as TARGET (including Yemen→Saudi waves).
  const saudiAsTarget =
    /(?:target|targets|attack|attacks|missile|ballistic|drone|impact|פגיעה|תקיפה|שיגור).{0,60}(?:saudi|סעודיה|aramco|jazan|yanbu|khamis|dammam|dhahran|riyadh)/i.test(
      text,
    ) ||
    /(?:saudi|סעודיה|aramco|jazan|yanbu|khamis|dammam|dhahran).{0,60}(?:target|attack|missile|ballistic|drone|impact|פגיעה|fire)/i.test(
      text,
    );

  const gulfAsTarget =
    saudiAsTarget ||
    /(?:על|ל|לעבר|toward|towards|on|in)\s*(?:כווית|בחריין|קטאר|דובאי|אבו דאבי|אמירויות|bahrain|kuwait|qatar|dubai|abu dhabi|uae|dammam)/i.test(
      text,
    ) ||
    /(?:כווית|בחריין|קטאר|bahrain|kuwait|qatar).{0,30}(?:פגיעה|תקיפה|שיגור|טיל|impact|attack|missile)/i.test(
      text,
    ) ||
    /(?:ballistic|missile|drone|טיל|בליסטי|כטב).{0,40}(?:bahrain|kuwait|qatar|כווית|בחריין|קטאר)/i.test(
      text,
    ) ||
    mentionsKuwait(text) ||
    firstGulfTarget(text) != null;

  if (!gulfAsTarget) return false;

  return /שיגור|טיל|בליסטי|כטב.?מ|ירי|פגיעה|תקיפה|ballistic|missile|drone|attack|impact|strike|rocket|fire/i.test(
    text,
  );
}

function gulfStrikeToAlert(
  message: TelegramChannelMessage,
): MissileAlert | null {
  if (!isGulfStrikeMessage(message.text)) return null;
  // Prefer structured track when possible.
  const track = messageToTrack(message, new Date(), {
    defaultCorridor: "kuwait",
  });
  if (track && isRegionalRelevant(track, message.text)) {
    const gulf = firstGulfTarget(message.text);
    if (gulf) {
      track.target = gulf.position;
      track.targetLabelHe = gulf.labelHe;
    }
    return trackToMissileAlert(track);
  }

  const gulf = firstGulfTarget(message.text) ?? KUWAIT_DEFAULT_TARGET;
  const snippet = message.text.replace(/\s+/g, " ").trim().slice(0, 200);
  const maps = mapsUrl(gulf.position.lat, gulf.position.lng);
  const weapon = /drone|כטב|מל.?ט/i.test(message.text)
    ? "טיל/כטב״מ"
    : /ballistic|בליסטי/i.test(message.text)
      ? "בליסטי"
      : "לא צוין";

  const base = {
    id: `gulf-${message.id}`,
    originLabelHe: /איראן|iran/i.test(message.text)
      ? "איראן (משוער)"
      : "לא צוין",
    targetLabelHe: gulf.labelHe,
    origin: { lat: 28.92, lng: 50.84 },
    target: gulf.position,
    location: toLocation(
      gulf.labelHe,
      gulf.position.lat,
      gulf.position.lng,
      "target",
    ),
    launchLocation: toLocation("איראן (משוער)", 28.92, 50.84, "launch"),
    launchedAt: message.datetime,
    etaSeconds: 0,
    weaponHe: weapon,
    sourceHe: `@${message.channel}`,
    sourceUrl: message.url,
    mapsUrl: maps,
  };

  const lines = [
    `🚨 התראת מפרץ · יעד: ${gulf.labelHe}`,
    "",
    `📍 מקור/משגר (משוער): ${base.originLabelHe}`,
    `🎯 לאן: ${gulf.labelHe}`,
    `🧭 סוג: ${weapon}`,
    `🕐 דיווח: ${formatClock(message.datetime)} (שעון כווית)`,
    "⏱ מתי מגיעים: לא צוין / באירוע",
    "",
    `דיווח: ${snippet}`,
    "",
    `🗺 מפה: ${maps}`,
    `מקור: @${message.channel}`,
    message.url,
    "",
    "⚠️ מיקום מקורב לפי דיווח פומבי/OSINT",
  ];

  return { ...base, text: boldEveryLine(lines.join("\n")) };
}

export function messagesToMissileAlerts(
  messages: TelegramChannelMessage[],
  now = new Date(),
): MissileAlert[] {
  const alerts: MissileAlert[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    const gulfAlert = gulfStrikeToAlert(message);
    if (gulfAlert && !seen.has(gulfAlert.id)) {
      seen.add(gulfAlert.id);
      alerts.push(gulfAlert);
      continue;
    }

    const track = messageToTrack(message, now, {
      defaultCorridor:
        mentionsGulf(message.text) || mentionsKuwait(message.text)
          ? "kuwait"
          : "israel",
    });
    if (!track) continue;
    if (!isRegionalRelevant(track, message.text)) continue;
    if (
      !isIranOriginTrack(track, message.text) &&
      !mentionsGulf(message.text) &&
      !mentionsKuwait(message.text)
    ) {
      continue;
    }

    const gulf = firstGulfTarget(message.text);
    if (gulf) {
      track.target = gulf.position;
      track.targetLabelHe = gulf.labelHe;
    } else if (
      remapIranLaunchesToKuwait() &&
      !mentionsGulf(message.text) &&
      !/כווית|בחריין|קטאר|kuwait|bahrain|qatar/i.test(track.targetLabelHe)
    ) {
      track.target = KUWAIT_DEFAULT_TARGET.position;
      track.targetLabelHe = KUWAIT_DEFAULT_TARGET.labelHe;
    }

    const alert = trackToMissileAlert(track);
    if (seen.has(alert.id)) continue;
    seen.add(alert.id);
    alerts.push(alert);
  }

  for (const air of messagesToAircraftAlerts(messages, now)) {
    if (seen.has(air.id)) continue;
    seen.add(air.id);
    alerts.push(air);
  }

  return alerts;
}

export function createDemoMissileAlert(now = new Date()): MissileAlert {
  const track: RocketTrack = {
    id: `demo-kuwait-${now.getTime()}`,
    labelHe: "איראן · כרמאנשאה",
    origin: { lat: 34.31, lng: 47.07 },
    originLabelHe: "אזור כרמאנשאה",
    target: KUWAIT_DEFAULT_TARGET.position,
    targetLabelHe: KUWAIT_DEFAULT_TARGET.labelHe,
    progress: 0.35,
    status: "midcourse",
    sourceHe: "הדגמה",
    launchedAt: now.toISOString(),
    etaSeconds: 210,
    speedHintHe: "בליסטי",
  };
  return trackToMissileAlert(track);
}
