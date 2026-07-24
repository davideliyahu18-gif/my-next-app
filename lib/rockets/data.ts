import type { LaunchSite, RocketTrack } from "./types";

/**
 * Approximate public/OSINT regions reported in open media.
 * These are illustrative area markers — not precise launcher coordinates.
 */
export const LAUNCH_SITES: LaunchSite[] = [
  {
    id: "kermanshah",
    nameHe: "אזור כרמאנשאה",
    nameEn: "Kermanshah region",
    region: "מערב איראן",
    position: { lat: 34.31, lng: 47.07 },
    precision: "region",
    noteHe: "אזור שדווח במקורות פתוחים כמסדרון שיגור מערבי.",
  },
  {
    id: "isfahan",
    nameHe: "אזור אספהאן",
    nameEn: "Isfahan region",
    region: "מרכז איראן",
    position: { lat: 32.65, lng: 51.68 },
    precision: "region",
    noteHe: "מתחם תעשייה/טילים שמוזכר בדיווחים פומביים.",
  },
  {
    id: "shiraz",
    nameHe: "אזור שיראז",
    nameEn: "Shiraz / Fars",
    region: "דרום־מרכז",
    position: { lat: 29.61, lng: 52.53 },
    precision: "area",
    noteHe: "דיווחים פומביים על פעילות באזור פארס.",
  },
  {
    id: "tabriz",
    nameHe: "אזור תבריז",
    nameEn: "Tabriz region",
    region: "צפון־מערב",
    position: { lat: 38.08, lng: 46.29 },
    precision: "region",
    noteHe: "מסדרון צפון־מערבי שמופיע במפות OSINT כלליות.",
  },
  {
    id: "bushehr",
    nameHe: "אזור בושהר",
    nameEn: "Bushehr coast",
    region: "חוף המפרץ",
    position: { lat: 28.92, lng: 50.84 },
    precision: "area",
    noteHe: "אזור חופי שדווח בהקשרים פומביים.",
  },
];

const TARGETS = {
  telAviv: { lat: 32.0853, lng: 34.7818, label: "תל אביב" },
  haifa: { lat: 32.794, lng: 34.9896, label: "חיפה" },
  south: { lat: 31.25, lng: 34.8, label: "דרום ישראל" },
} as const;

/** Demo tracks for the visualization — not live military telemetry. */
export function createDemoTracks(now = Date.now()): RocketTrack[] {
  const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

  return [
    {
      id: "trk-alpha",
      labelHe: "מסלול α · כרמאנשאה",
      origin: LAUNCH_SITES[0].position,
      originLabelHe: LAUNCH_SITES[0].nameHe,
      target: TARGETS.telAviv,
      targetLabelHe: TARGETS.telAviv.label,
      progress: 0.42,
      status: "midcourse",
      sourceHe: "הדגמה · מקור פומבי מדומה",
      launchedAt: iso(6 * 60_000),
      etaSeconds: 420,
      speedHintHe: "בליסטי · בינוני",
    },
    {
      id: "trk-bravo",
      labelHe: "מסלול β · אספהאן",
      origin: LAUNCH_SITES[1].position,
      originLabelHe: LAUNCH_SITES[1].nameHe,
      target: TARGETS.haifa,
      targetLabelHe: TARGETS.haifa.label,
      progress: 0.18,
      status: "boost",
      sourceHe: "הדגמה · דיווח איראני מדומה",
      launchedAt: iso(2 * 60_000),
      etaSeconds: 780,
      speedHintHe: "בליסטי · ארוך טווח",
    },
    {
      id: "trk-charlie",
      labelHe: "מסלול γ · שיראז",
      origin: LAUNCH_SITES[2].position,
      originLabelHe: LAUNCH_SITES[2].nameHe,
      target: TARGETS.south,
      targetLabelHe: TARGETS.south.label,
      progress: 0.78,
      status: "terminal",
      sourceHe: "הדגמה · OSINT",
      launchedAt: iso(11 * 60_000),
      etaSeconds: 95,
      speedHintHe: "שלב סופי",
    },
  ];
}

export const STATUS_LABEL: Record<RocketTrack["status"], string> = {
  pending: "ממתין",
  boost: "שיגור",
  midcourse: "במסלול",
  terminal: "שלב סופי",
  impact: "סיום",
  intercepted: "יורט",
};
