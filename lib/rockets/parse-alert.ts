import { matchPlaces } from "./locations";
import type { TelegramChannelMessage } from "./telegram";
import type { LatLng, RocketTrack, RocketTrackStatus } from "./types";
import { statusFromProgress } from "./geo";

function isLaunchRelatedMessage(text: string): boolean {
  return (
    /שיגור|יציאות מאיראן|מיקום המשגר|גורם משגר|טיל בליסטי|ירי לעבר/.test(
      text,
    ) ||
    (/בליסטי|כטב.?מ/.test(text) && /משגר|יציאות|שיגור/.test(text))
  );
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

function parseEtaSeconds(text: string, now: Date): number | null {
  const etaField =
    field(text, "צפי הגעה") ??
    text.match(/צפי הגעה[^0-9]*(\d{1,2}:\d{2}(?::\d{2})?)/)?.[1] ??
    null;
  if (!etaField) return null;

  const timeMatch = etaField.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] ?? "0");

  // Interpret clock as Asia/Jerusalem wall time on the message day.
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const day = formatter.format(now); // YYYY-MM-DD
  const asUtcGuess = Date.parse(
    `${day}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}+03:00`,
  );
  if (Number.isNaN(asUtcGuess)) return null;
  return Math.round((asUtcGuess - now.getTime()) / 1000);
}

function pickTarget(text: string): { position: LatLng; labelHe: string } {
  const targets = matchPlaces(text, "target");
  if (targets[0]) {
    return { position: targets[0].position, labelHe: targets[0].labelHe };
  }
  if (/ירדן|עקבה/.test(text)) {
    return { position: { lat: 29.53, lng: 35.0 }, labelHe: "עקבה / ירדן" };
  }
  return { position: { lat: 32.0853, lng: 34.7818 }, labelHe: "ישראל (כללי)" };
}

function pickOrigin(text: string): { position: LatLng; labelHe: string } | null {
  const launcherField =
    field(text, "מיקום המשגר") ??
    field(text, "מיקום משגר") ??
    text.match(/מיקום משגר\s*:\s*([^\n]+)/i)?.[1] ??
    null;

  const search = launcherField ?? text;
  const launches = matchPlaces(search, "launch");
  if (launches[0]) {
    const labels = launches.map((p) => p.labelHe).join(", ");
    return { position: launches[0].position, labelHe: labels };
  }
  return null;
}

function weaponHint(text: string): string {
  if (/בליסטי/.test(text)) return "בליסטי";
  if (/כטב.?מ|מל.?ט/.test(text)) return "כטב״מ";
  if (/שיוט/.test(text)) return "שיוט";
  return "לא צוין";
}

function computeProgress(
  launchedAtMs: number,
  etaSeconds: number | null,
  nowMs: number,
): { progress: number; etaLeft: number; status: RocketTrackStatus } {
  const ageSec = Math.max(0, (nowMs - launchedAtMs) / 1000);
  const flightWindow =
    etaSeconds != null && etaSeconds > 30
      ? Math.max(90, ageSec + etaSeconds)
      : 12 * 60;
  const progress = Math.min(1, ageSec / flightWindow);
  const etaLeft =
    etaSeconds != null
      ? Math.max(0, etaSeconds)
      : Math.max(0, Math.round(flightWindow - ageSec));
  return {
    progress,
    etaLeft,
    status: statusFromProgress(progress),
  };
}

export function isLaunchRelated(text: string): boolean {
  return isLaunchRelatedMessage(text);
}

export function messageToTrack(
  message: TelegramChannelMessage,
  now = new Date(),
): RocketTrack | null {
  if (!isLaunchRelatedMessage(message.text)) return null;

  const origin = pickOrigin(message.text);
  if (!origin) return null;

  // Skip pure "strike inside Iran" posts without outbound launches.
  if (
    /תקיפה|פיצוצים/.test(message.text) &&
    !/יציאות מאיראן|מיקום המשגר|שיגור|גורם משגר/.test(message.text)
  ) {
    return null;
  }

  const target = pickTarget(message.text);
  const launchedAtMs = Date.parse(message.datetime);
  const etaSeconds = parseEtaSeconds(message.text, now);
  const { progress, etaLeft, status } = computeProgress(
    Number.isNaN(launchedAtMs) ? now.getTime() : launchedAtMs,
    etaSeconds,
    now.getTime(),
  );

  const actor =
    field(message.text, "גורם משגר") ??
    (/איראן/.test(message.text) ? "איראן" : null) ??
    (/תימן/.test(message.text) ? "תימן" : "לא צוין");

  return {
    id: `tg-${message.id}`,
    labelHe: `${actor} · ${origin.labelHe}`,
    origin: origin.position,
    originLabelHe: origin.labelHe,
    target: target.position,
    targetLabelHe: target.labelHe,
    progress,
    status,
    sourceHe: `@${message.channel}`,
    launchedAt: message.datetime,
    etaSeconds: etaLeft,
    speedHintHe: weaponHint(message.text),
    sourceUrl: message.url,
    rawText: message.text.slice(0, 500),
  };
}

export function messagesToTracks(
  messages: TelegramChannelMessage[],
  now = new Date(),
  options?: { maxAgeHours?: number },
): RocketTrack[] {
  const maxAgeHours = options?.maxAgeHours ?? 36;
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const tracks: RocketTrack[] = [];
  const seen = new Set<string>();

  const recent = messages.filter((message) => {
    const ts = Date.parse(message.datetime);
    return !Number.isNaN(ts) && now.getTime() - ts <= maxAgeMs;
  });

  const pool = recent.length > 0 ? recent : messages.slice(0, 8);

  for (const message of pool) {
    const track = messageToTrack(message, now);
    if (!track) continue;
    const key = `${track.originLabelHe}|${track.targetLabelHe}|${track.launchedAt.slice(0, 16)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push(track);
  }

  return tracks.slice(0, 12);
}
