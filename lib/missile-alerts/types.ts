import type { LatLng } from "@/lib/rockets/types";

export type MissileAlertLocation = {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
};

export type MissileAlert = {
  id: string;
  text: string;
  originLabelHe: string;
  targetLabelHe: string;
  origin: LatLng;
  target: LatLng;
  /** Primary WhatsApp location pin — usually approximate target area. */
  location: MissileAlertLocation;
  /** Optional second pin for approximate launch region. */
  launchLocation?: MissileAlertLocation;
  launchedAt: string;
  etaSeconds: number;
  weaponHe: string;
  sourceHe: string;
  sourceUrl?: string;
  mapsUrl: string;
};
