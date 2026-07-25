import { AIRPORT_LABELS, COUNTRY_LABELS, FLIGHT_DEALS_MAX_PRICE_USD } from "./constants";
import type { FlightDeal } from "./types";

const USD_TO_ILS = Number(process.env.FLIGHT_DEALS_USD_ILS_RATE ?? "3.7");

const ENGLISH_CITY_TO_HEBREW: Record<string, string> = {
  athens: "אתונה",
  budapest: "בודפשט",
  rome: "רומא",
  milan: "מילאנו",
  venice: "ונציה",
  barcelona: "ברצלונה",
  madrid: "מדריד",
  london: "לונדון",
  paris: "פריז",
  prague: "פראג",
  vienna: "וינה",
  warsaw: "ורשה",
  krakow: "קרקוב",
  cracow: "קרקוב",
  sofia: "סופיה",
  bucharest: "בוקרשט",
  istanbul: "איסטנבול",
  larnaca: "לרנקה",
  paphos: "פאפוס",
  dubai: "דובאי",
  naples: "נאפולי",
  napoli: "נאפולי",
  berlin: "ברלין",
  amsterdam: "אמסטרדם",
  "tel aviv": "תל אביב",
};

function hasHebrew(value: string): boolean {
  return /[\u0590-\u05FF]/.test(value);
}

function isAirportCode(value: string): boolean {
  return /^[A-Za-z]{3}$/.test(value.trim());
}

function hebrewDestination(deal: FlightDeal): string {
  const candidates = [
    deal.destinationNameHe,
    AIRPORT_LABELS[deal.destination],
    deal.destination,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const value = String(raw).trim();
    if (!value) continue;
    if (isAirportCode(value)) {
      const mapped = AIRPORT_LABELS[value.toUpperCase()];
      if (mapped) return mapped;
      continue;
    }
    if (hasHebrew(value)) return value;
    const mappedEnglish = ENGLISH_CITY_TO_HEBREW[value.toLowerCase()];
    if (mappedEnglish) return mappedEnglish;
  }

  return AIRPORT_LABELS[deal.destination] ?? "יעד לא ידוע";
}

function hebrewCountry(deal: FlightDeal): string {
  const fromDeal = deal.countryNameHe?.trim();
  if (fromDeal && hasHebrew(fromDeal)) return fromDeal;
  return COUNTRY_LABELS[deal.destination] ?? "";
}

function formatIsraeliDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

const DAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function hebrewDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  return DAY_HE[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
}

function formatPrice(deal: FlightDeal): string {
  if (deal.currency === "ILS" || deal.currency === "ils") {
    return `₪${Math.round(deal.priceUsd)}`;
  }
  const ils = Math.round(deal.priceUsd * USD_TO_ILS);
  return `₪${ils} (כ־$${deal.priceUsd.toFixed(0)})`;
}

export function formatDealMessage(deal: FlightDeal): string {
  const destLabel = hebrewDestination(deal);
  const country = hebrewCountry(deal);
  const depart = formatIsraeliDate(deal.departureDate);
  const ret = formatIsraeliDate(deal.returnDate);
  const priceLine = formatPrice(deal);
  const max = FLIGHT_DEALS_MAX_PRICE_USD;
  const outDay = hebrewDay(deal.departureDate);
  const backDay = hebrewDay(deal.returnDate);

  const lines = [
    "🔥 *מכירה מצוינת!*",
    "",
    country ? `*${destLabel}, ${country}*` : `*${destLabel}*`,
    `📅 יציאה ${outDay}: ${depart}`,
    `📅 חזרה ${backDay}: ${ret}`,
    `💰 ${priceLine} *הלוך ושוב*`,
    `✈️ מתל אביב · רביעי→שני / חמישי→ראשון · יולי–דצמבר · עד ${max}$`,
  ];

  if (deal.bookingUrl) {
    lines.push("", `🔗 קישור להזמנה:\n${deal.bookingUrl}`);
  }

  return lines.join("\n");
}
