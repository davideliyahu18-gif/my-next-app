export type RocketTrackStatus = "pending" | "boost" | "midcourse" | "terminal" | "impact" | "intercepted";

export type LatLng = {
  lat: number;
  lng: number;
};

export type LaunchSite = {
  id: string;
  nameHe: string;
  nameEn: string;
  region: string;
  position: LatLng;
  /** Approximate public/OSINT region — not a precise military coordinate. */
  precision: "region" | "area";
  noteHe: string;
};

/** Israeli alert area with illustrative shelter-entry time. */
export type AlertArea = {
  id: string;
  labelHe: string;
  regionHe: string;
  aliases: string[];
  position: LatLng;
  /** Seconds to enter protected space (זמן למרחב מוגן) — public reference. */
  shelterSeconds: number;
};

export type ActiveAlertArea = {
  id: string;
  labelHe: string;
  regionHe: string;
  position: LatLng;
  shelterSeconds: number;
  /** How many recent launch tracks mention this area. */
  hitCount: number;
  lastSeenAt: string;
};

export type RocketTrack = {
  id: string;
  labelHe: string;
  origin: LatLng;
  originLabelHe: string;
  target: LatLng;
  targetLabelHe: string;
  /** 0..1 along the trajectory */
  progress: number;
  status: RocketTrackStatus;
  sourceHe: string;
  launchedAt: string;
  etaSeconds: number;
  speedHintHe: string;
  sourceUrl?: string;
  rawText?: string;
  /** Matched Israeli alert areas from the report text. */
  alertAreas?: ActiveAlertArea[];
  /** Shortest זמן למרחב מוגן among matched areas (seconds). */
  shelterSeconds?: number;
};

export type RocketFeedItem = {
  id: string;
  channel: string;
  url: string;
  text: string;
  datetime: string;
  related: boolean;
  imageUrl?: string;
};

export type RocketsSnapshot = {
  ok: boolean;
  mode: "live" | "demo";
  tracks: RocketTrack[];
  feed: RocketFeedItem[];
  /** Aggregated Israeli areas currently under launch-related reports. */
  activeAreas?: ActiveAlertArea[];
  sources: { username: string; label: string }[];
  errors: string[];
  timestamp: string;
  /** Monitoring counters — every Telegram post is tracked in the feed. */
  stats?: {
    scanned: number;
    feed: number;
    related: number;
    tracks: number;
  };
};

export type MapBounds = {
  north: number;
  south: number;
  west: number;
  east: number;
};
