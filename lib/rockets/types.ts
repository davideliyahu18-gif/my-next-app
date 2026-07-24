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
};

export type MapBounds = {
  north: number;
  south: number;
  west: number;
  east: number;
};
