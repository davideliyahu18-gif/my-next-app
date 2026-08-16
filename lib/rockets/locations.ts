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
    aliases: ["תל אביב", "ת״א", "ת'א", "גוש דן"],
    position: { lat: 32.0853, lng: 34.7818 },
    kind: "target",
  },
  {
    id: "jerusalem",
    labelHe: "ירושלים",
    aliases: ["ירושלים", "ירושלם"],
    position: { lat: 31.7683, lng: 35.2137 },
    kind: "target",
  },
  {
    id: "haifa",
    labelHe: "חיפה",
    aliases: ["חיפה", "קריות"],
    position: { lat: 32.794, lng: 34.9896 },
    kind: "target",
  },
  {
    id: "ashdod",
    labelHe: "אשדוד",
    aliases: ["אשדוד"],
    position: { lat: 31.8044, lng: 34.6553 },
    kind: "target",
  },
  {
    id: "ashkelon",
    labelHe: "אשקלון",
    aliases: ["אשקלון"],
    position: { lat: 31.6688, lng: 34.5743 },
    kind: "target",
  },
  {
    id: "beer-sheva",
    labelHe: "באר שבע",
    aliases: ["באר שבע", "באר-שבע", "ב״ש"],
    position: { lat: 31.253, lng: 34.7915 },
    kind: "target",
  },
  {
    id: "gaza-envelope",
    labelHe: "עוטף עזה",
    aliases: ["עוטף", "שדרות", "נתיבות", "אופקים"],
    position: { lat: 31.45, lng: 34.55 },
    kind: "target",
  },
  {
    id: "eilat",
    labelHe: "אילת",
    aliases: ["אילת"],
    position: { lat: 29.5577, lng: 34.9519 },
    kind: "target",
  },
  {
    id: "north",
    labelHe: "צפון",
    aliases: ["צפון", "צפת", "גולן", "קריית שמונה", "נהריה", "עכו"],
    position: { lat: 33.0, lng: 35.5 },
    kind: "target",
  },
  {
    id: "center",
    labelHe: "מרכז",
    aliases: ["מרכז", "השרון", "נתניה", "הרצליה"],
    position: { lat: 32.1, lng: 34.9 },
    kind: "target",
  },
  {
    id: "south",
    labelHe: "דרום",
    aliases: ["דרום"],
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
  {
    id: "kuwait",
    labelHe: "כווית",
    aliases: ["כווית", "الكويت", "kuwait"],
    position: { lat: 29.38, lng: 47.99 },
    kind: "target",
  },
  {
    id: "bahrain",
    labelHe: "בחריין",
    aliases: ["בחריין", "البحرين", "bahrain"],
    position: { lat: 26.07, lng: 50.55 },
    kind: "target",
  },
  {
    id: "israel",
    labelHe: "ישראל",
    aliases: ["ישראל", "לעבר ישראל"],
    position: { lat: 31.5, lng: 34.85 },
    kind: "target",
  },
  {
    id: "iran-general",
    labelHe: "איראן",
    aliases: ["מאיראן", "מאיראן", "איראן"],
    position: { lat: 32.8, lng: 51.4 },
    kind: "launch",
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
