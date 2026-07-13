import { AIRPORT_LABELS } from "./constants";
import type { FlightDeal } from "./types";

function airportLabel(code: string): string {
  return AIRPORT_LABELS[code] ?? code;
}

function formatIsraeliDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function formatDealMessage(deal: FlightDeal): string {
  const originLabel = airportLabel(deal.origin);
  const destLabel = airportLabel(deal.destination);
  const depart = formatIsraeliDate(deal.departureDate);
  const ret = formatIsraeliDate(deal.returnDate);
  const price = deal.priceUsd.toFixed(2);

  const lines = [
    "🛫 *דיל טיסה עד $50!*",
    "",
    `✈️ מסלול: ${originLabel} (${deal.origin}) ↔ ${destLabel} (${deal.destination})`,
    `📅 יציאה: ${depart}`,
    `📅 חזרה: ${ret}`,
    `💰 מחיר: $${price} (הלוך-חזור)`,
  ];

  if (deal.bookingUrl) {
    lines.push("", `🔗 ${deal.bookingUrl}`);
  }

  return lines.join("\n");
}
