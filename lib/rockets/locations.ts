import type { LatLng } from "./types";

export type NamedPlace = {
  id: string;
  labelHe: string;
  aliases: string[];
  position: LatLng;
  kind: "launch" | "target";
};

/** Approximate public/OSINT place centers for matching alert text. */
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
    id: "kuwait-city",
    labelHe: "כווית סיטי",
    aliases: [
      "כווית סיטי",
      "כווית",
      "الكويت",
      "مدينة الكويت",
      "kuwait city",
      "kuwait",
    ],
    position: { lat: 29.3759, lng: 47.9774 },
    kind: "target",
  },
  {
    id: "ahmadi",
    labelHe: "אל־אחמדי",
    aliases: ["אחמדי", "אל־אחמדי", "الأحمدي", "ahmadi"],
    position: { lat: 29.0769, lng: 48.0838 },
    kind: "target",
  },
  {
    id: "jahra",
    labelHe: "אל־ג׳הרה",
    aliases: ["ג׳הרה", "ג'הרה", "الجهراء", "jahra"],
    position: { lat: 29.3375, lng: 47.6581 },
    kind: "target",
  },
  {
    id: "hawalli",
    labelHe: "חוואלי",
    aliases: ["חוואלי", "حولي", "hawalli"],
    position: { lat: 29.3328, lng: 48.0281 },
    kind: "target",
  },
  {
    id: "arifjan",
    labelHe: "קמפ עריפג׳אן",
    aliases: ["עריפג׳אן", "עריפג'אן", "arifjan", "camp arifjan"],
    position: { lat: 28.88, lng: 48.17 },
    kind: "target",
  },
  {
    id: "kuwait-airport",
    labelHe: "נמל התעופה כווית",
    aliases: ["נמל התעופה כווית", "مطار الكويت", "kuwait airport"],
    position: { lat: 29.2266, lng: 47.9689 },
    kind: "target",
  },
  {
    id: "bahrain",
    labelHe: "בחריין",
    aliases: ["בחריין", "البحرين", "bahrain", "manama", "מנאמה"],
    position: { lat: 26.2285, lng: 50.586 },
    kind: "target",
  },
  {
    id: "uae-dubai",
    labelHe: "דובאי",
    aliases: ["דובאי", "دبي", "dubai", "uae", "אמירויות", "الإمارات"],
    position: { lat: 25.2048, lng: 55.2708 },
    kind: "target",
  },
  {
    id: "uae-abu-dhabi",
    labelHe: "אבו דאבי",
    aliases: ["אבו דאבי", "أبو ظبي", "abu dhabi"],
    position: { lat: 24.4539, lng: 54.3773 },
    kind: "target",
  },
  {
    id: "qatar",
    labelHe: "קטאר",
    aliases: ["קטאר", "قطر", "qatar", "doha", "דוחה"],
    position: { lat: 25.2854, lng: 51.531 },
    kind: "target",
  },
  {
    id: "saudi-dammam",
    labelHe: "דמאם / מזרח סעודיה",
    aliases: [
      "דמאם",
      "الدمام",
      "dammam",
      "dhahran",
      "ظهران",
      "סעודיה",
      "السعودية",
      "saudi",
    ],
    position: { lat: 26.4207, lng: 50.0888 },
    kind: "target",
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

export const KUWAIT_DEFAULT_TARGET: NamedPlace = PLACES.find(
  (place) => place.id === "kuwait-city",
)!;

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

const KUWAIT_PLACE_IDS = new Set([
  "kuwait-city",
  "ahmadi",
  "jahra",
  "hawalli",
  "arifjan",
  "kuwait-airport",
]);

const GULF_PLACE_IDS = new Set([
  ...KUWAIT_PLACE_IDS,
  "bahrain",
  "uae-dubai",
  "uae-abu-dhabi",
  "qatar",
  "saudi-dammam",
]);

export function mentionsKuwait(text: string): boolean {
  return matchPlaces(text, "target").some((place) =>
    KUWAIT_PLACE_IDS.has(place.id),
  );
}

/** Kuwait / Bahrain / UAE / Qatar / eastern Saudi — regional alert corridor. */
export function mentionsGulf(text: string): boolean {
  if (
    /כווית|الكويت|kuwait|בחריין|البحرين|bahrain|אמירויות|الإمارات|uae|dubai|דובאי|אבו דאבי|abu dhabi|קטאר|قطر|qatar|doha|סעודיה|السعودية|saudi|dammam|dhahran|מפרץ/i.test(
      text,
    )
  ) {
    return true;
  }
  return matchPlaces(text, "target").some((place) => GULF_PLACE_IDS.has(place.id));
}

export function firstGulfTarget(text: string): NamedPlace | null {
  const targets = matchPlaces(text, "target");
  return targets.find((place) => GULF_PLACE_IDS.has(place.id)) ?? null;
}
