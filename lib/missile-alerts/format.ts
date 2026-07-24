import { KUWAIT_DEFAULT_TARGET, mentionsKuwait } from "@/lib/rockets/locations";
import { messageToTrack } from "@/lib/rockets/parse-alert";
import type { TelegramChannelMessage } from "@/lib/rockets/telegram";
import type { RocketTrack } from "@/lib/rockets/types";
import type { MissileAlert, MissileAlertLocation } from "./types";

function corridorIsKuwait(): boolean {
  return (process.env.MISSILE_ALERT_CORRIDOR ?? "kuwait").toLowerCase() !== "israel";
}

/** When true, every Iran launch becomes a Kuwait WhatsApp alert (even without "כווית"). */
function remapIranLaunchesToKuwait(): boolean {
  return (process.env.MISSILE_ALERT_REMAP_IRAN_LAUNCHES ?? "false") === "true";
}

function onlyExplicitKuwait(): boolean {
  // Default: require explicit Kuwait mention unless remap mode is on.
  if (remapIranLaunchesToKuwait()) return false;
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
    "🚨 *התראת שיגור · איראן → כווית*",
    "",
    `📍 משגר (משוער): ${alert.originLabelHe}`,
    `🎯 יעד (משוער): ${alert.targetLabelHe}`,
    `🧭 סוג: ${alert.weaponHe}`,
    `🕐 שיגור: ${formatClock(alert.launchedAt)} (שעון כווית)`,
    `⏱ צפי הגעה: ${etaLabel(alert.etaSeconds)}`,
    "",
    `🗺 מפה: ${alert.mapsUrl}`,
    `מקור: ${alert.sourceHe}${alert.sourceUrl ? `\n${alert.sourceUrl}` : ""}`,
    "",
    "⚠️ מיקום מקורב לפי דיווח פומבי/OSINT — לא קואורדינטה צבאית מדויקת.",
  ];
  return lines.join("\n");
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
  // Named Iranian launch regions imply Iran corridor.
  return /כרמאנשאה|אספהאן|שיראז|תבריז|בושהר|טהרן|המדאן|זנג|יזד|בידגנה/.test(
    track.originLabelHe,
  );
}

function isKuwaitRelevant(track: RocketTrack, text: string): boolean {
  if (mentionsKuwait(text)) return true;
  if (/כווית|الكويت|kuwait/i.test(track.targetLabelHe)) return true;
  if (onlyExplicitKuwait()) return false;
  if (!corridorIsKuwait()) return false;
  // Opt-in remap: Iran outbound launches → Kuwait WhatsApp alerts.
  return remapIranLaunchesToKuwait() && isIranOriginTrack(track, text);
}

export function messagesToMissileAlerts(
  messages: TelegramChannelMessage[],
  now = new Date(),
): MissileAlert[] {
  const alerts: MissileAlert[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    // Parse with natural targets first (do not force Kuwait onto Israel alerts).
    const track = messageToTrack(message, now, {
      defaultCorridor: mentionsKuwait(message.text) ? "kuwait" : "israel",
    });
    if (!track) continue;
    if (!isKuwaitRelevant(track, message.text)) continue;
    if (!isIranOriginTrack(track, message.text) && !mentionsKuwait(message.text)) {
      continue;
    }

    // Remap target to Kuwait City only when opted-in and Kuwait was not named.
    if (
      remapIranLaunchesToKuwait() &&
      !mentionsKuwait(message.text) &&
      !/כווית|الكويت|kuwait/i.test(track.targetLabelHe)
    ) {
      track.target = KUWAIT_DEFAULT_TARGET.position;
      track.targetLabelHe = KUWAIT_DEFAULT_TARGET.labelHe;
    }

    const alert = trackToMissileAlert(track);
    if (seen.has(alert.id)) continue;
    seen.add(alert.id);
    alerts.push(alert);
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
