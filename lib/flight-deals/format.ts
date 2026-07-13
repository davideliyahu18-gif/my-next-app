import { AIRPORT_LABELS, COUNTRY_LABELS, FLIGHT_DEALS_MAX_PRICE_USD } from "./constants";
import type { FlightDeal } from "./types";

const USD_TO_ILS = Number(process.env.FLIGHT_DEALS_USD_ILS_RATE ?? "3.7");

function airportLabel(code: string): string {
  return AIRPORT_LABELS[code] ?? code;
}

function countryLabel(code: string): string {
  return COUNTRY_LABELS[code] ?? "";
}

function formatIsraeliDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function formatPrice(deal: FlightDeal): string {
  if (deal.currency === "ILS" || deal.currency === "ils") {
    return `₪${Math.round(deal.priceUsd)}`;
  }
  const ils = Math.round(deal.priceUsd * USD_TO_ILS);
  return `₪${ils} (~$${deal.priceUsd.toFixed(0)})`;
}

export function formatDealMessage(deal: FlightDeal): string {
  const destLabel = airportLabel(deal.destination);
  const country = countryLabel(deal.destination);
  const depart = formatIsraeliDate(deal.departureDate);
  const ret = formatIsraeliDate(deal.returnDate);
  const priceLine = formatPrice(deal);

  const lines = [
    "🔥 *מכירה מצוינת!*",
    "",
    country ? `*${destLabel}, ${country}*` : `*${destLabel}*`,
    `📅 יציאה: ${depart}`,
    `📅 חזרה: ${ret}`,
    `💰 ${priceLine} *הלוך ושוב*`,
    `✈️ מ-TLV · עד $${FLIGHT_DEALS_MAX_PRICE_USD}`,
  ];

  if (deal.bookingUrl) {
    lines.push("", `🔗 ${deal.bookingUrl}`);
  }

  return lines.join("\n");
}
