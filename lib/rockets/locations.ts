import type { LatLng } from "./types";

export type NamedPlace = {
  id: string;
  labelHe: string;
  aliases: string[];
  position: LatLng;
  kind: "launch" | "target";
};

/** Approximate public/OSINT place centers for matching Telegram text. */
export const PLACES: NamedPlace[] = [
  {
    id: "isfahan",
    labelHe: "אספהאן",
    aliases: ["אספהאן", "איספהאן", "اصفهان", "isfahan"],
    position: { lat: 32.65, lng: 51.68 },
    kind: "launch",
  },
  {
    id: "tehran",
    labelHe: "טהרן",
    aliases: ["טהרן", "טהראן", "تهران", "tehran"],
    position: { lat: 35.69, lng: 51.39 },
    kind: "launch",
  },
  {
    id: "bidganeh",
    labelHe: "בידגנה",
    aliases: ["בידגנה", "בידגאנה", "بيدگنه"],
    position: { lat: 35.52, lng: 50.88 },
    kind: "launch",
  },
  {
    id: "zanjan",
    labelHe: "זנג׳אן",
    aliases: ["זנג׳אן", "זנג'אן", "זנגאן", "زنجان"],
    position: { lat: 36.67, lng: 48.48 },
    kind: "launch",
  },
  {
    id: "hamadan",
    labelHe: "המדאן",
    aliases: ["המדאן", "חמדאן", "همدان", "hamadan"],
    position: { lat: 34.8, lng: 48.51 },
    kind: "launch",
  },
  {
    id: "kermanshah",
    labelHe: "כרמאנשאה",
    aliases: ["כרמאנשאה", "کرمانشاه"],
    position: { lat: 34.31, lng: 47.07 },
    kind: "launch",
  },
  {
    id: "shiraz",
    labelHe: "שיראז",
    aliases: ["שיראז", "شیراز"],
    position: { lat: 29.61, lng: 52.53 },
    kind: "launch",
  },
  {
    id: "tabriz",
    labelHe: "תבריז",
    aliases: ["תבריז", "تبریز"],
    position: { lat: 38.08, lng: 46.29 },
    kind: "launch",
  },
  {
    id: "bushehr",
    labelHe: "בושהר",
    aliases: ["בושהר", "بوشهر"],
    position: { lat: 28.92, lng: 50.84 },
    kind: "launch",
  },
  {
    id: "yazd",
    labelHe: "יזד",
    aliases: ["יזד", "یزد"],
    position: { lat: 31.9, lng: 54.37 },
    kind: "launch",
  },
  {
    id: "saada",
    labelHe: "סעדה",
    aliases: ["סעדה", "صعدة", "saada"],
    position: { lat: 16.94, lng: 43.76 },
    kind: "launch",
  },
  {
    id: "tel-aviv",
    labelHe: "תל אביב",
    aliases: ["תל אביב", "ת״א", "ת'א", "חולון", "גוש דן"],
    position: { lat: 32.0853, lng: 34.7818 },
    kind: "target",
  },
  {
    id: "haifa",
    labelHe: "חיפה",
    aliases: ["חיפה"],
    position: { lat: 32.794, lng: 34.9896 },
    kind: "target",
  },
  {
    id: "north",
    labelHe: "צפון",
    aliases: ["צפון", "צפת", "גולן", "קריית שמונה"],
    position: { lat: 33.0, lng: 35.5 },
    kind: "target",
  },
  {
    id: "center",
    labelHe: "מרכז",
    aliases: ["מרכז", "השרון"],
    position: { lat: 32.1, lng: 34.9 },
    kind: "target",
  },
  {
    id: "south",
    labelHe: "דרום",
    aliases: ["דרום", "אשדוד", "אשקלון", "באר שבע"],
    position: { lat: 31.25, lng: 34.8 },
    kind: "target",
  },
  {
    id: "aqaba",
    labelHe: "עקבה",
    aliases: ["עקבה", "العقبة", "aqaba"],
    position: { lat: 29.53, lng: 35.0 },
    kind: "target",
  },
  {
    id: "jordan",
    labelHe: "ירדן",
    aliases: ["ירדן", "الأردن"],
    position: { lat: 31.95, lng: 35.91 },
    kind: "target",
  },
];

export function matchPlaces(
  text: string,
  kind?: NamedPlace["kind"],
): NamedPlace[] {
  const normalized = text.replace(/\u200f|\u200e/g, "");
  const found: NamedPlace[] = [];
  for (const place of PLACES) {
    if (kind && place.kind !== kind) continue;
    const hit = place.aliases.some((alias) =>
      normalized.toLowerCase().includes(alias.toLowerCase()),
    );
    if (hit && !found.some((p) => p.id === place.id)) {
      found.push(place);
    }
  }
  return found;
}
