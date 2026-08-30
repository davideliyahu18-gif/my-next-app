import { isAmadeusConfigured } from "@/lib/amadeus/auth";
import { searchFlightPrices } from "@/lib/amadeus/flights";
import type { FlightPriceOffer } from "@/lib/amadeus/types";
import { buildFlightLinks } from "./links";
import { formatDateHe, isCancel, isOneWayAnswer, isTrigger, parseDateHe } from "./parser";
import { clearConversation, getConversation, setConversation } from "./state";
import type { ConversationState } from "./types";

function formatClockTime(iso: string): string {
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : iso;
}

function formatStops(count: number): string {
  return count === 0 ? "ישירה" : `${count} החלפות`;
}

function formatLeg(leg: FlightPriceOffer["outbound"]): string {
  return `${formatClockTime(leg.departAt)}-${formatClockTime(leg.arriveAt)} ${leg.carrier} (${formatStops(leg.stops)})`;
}

function formatOfferLine(offer: FlightPriceOffer): string {
  const price = `${offer.currency} ${Math.round(Number(offer.priceTotal))}`;
  const outbound = formatLeg(offer.outbound);
  const inbound = offer.inbound ? ` | חזרה: ${formatLeg(offer.inbound)}` : "";
  return `• ${price} — ${outbound}${inbound}`;
}

async function formatResultsReply(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
}): Promise<string> {
  const { googleFlightsUrl, skyscannerUrl } = buildFlightLinks(input);
  const dates = input.returnDate
    ? `${formatDateHe(input.departDate)} – ${formatDateHe(input.returnDate)}`
    : `${formatDateHe(input.departDate)} (חד-כיווני)`;

  const lines = [`✈️ ${input.origin} ← ${input.destination}`, dates, ""];

  if (isAmadeusConfigured()) {
    try {
      const offers = await searchFlightPrices({
        origin: input.origin,
        destination: input.destination,
        departDate: input.departDate,
        returnDate: input.returnDate,
      });
      if (offers && offers.length > 0) {
        lines.push("💰 מחירים אמיתיים:");
        for (const offer of offers) lines.push(formatOfferLine(offer));
        lines.push("");
      }
    } catch {
      // real-price lookup failed — fall back to the deep links below
    }
  }

  lines.push(`Google Flights: ${googleFlightsUrl}`);
  if (skyscannerUrl) {
    lines.push(`Skyscanner: ${skyscannerUrl}`);
  }
  lines.push("", "לחיפוש נוסף כתבו 'טיסה' שוב.");

  return lines.join("\n");
}

/** Returns the WhatsApp reply text, or null when the message should be ignored silently. */
export async function handleIncomingMessage(
  chatId: string,
  rawText: string,
): Promise<string | null> {
  const text = (rawText ?? "").trim();
  if (!text) return null;

  if (isCancel(text)) {
    await clearConversation(chatId);
    return "בוטל. אפשר להתחיל שוב עם 'טיסה'.";
  }

  if (isTrigger(text)) {
    await setConversation(chatId, {
      step: "awaiting_origin",
      updatedAt: new Date().toISOString(),
    });
    return "✈️ בואו נחפש טיסה!\nמאיפה טסים?";
  }

  const existing = await getConversation(chatId);
  if (!existing) return null;

  return advanceConversation(chatId, existing, text);
}

async function advanceConversation(
  chatId: string,
  state: ConversationState,
  text: string,
): Promise<string> {
  const now = new Date().toISOString();

  switch (state.step) {
    case "awaiting_origin": {
      await setConversation(chatId, {
        ...state,
        origin: text,
        step: "awaiting_destination",
        updatedAt: now,
      });
      return `לאן טסים מ${text}?`;
    }

    case "awaiting_destination": {
      await setConversation(chatId, {
        ...state,
        destination: text,
        step: "awaiting_departure",
        updatedAt: now,
      });
      return "באיזה תאריך יציאה? (למשל 15/09/2026, או 'מחר')";
    }

    case "awaiting_departure": {
      const departDate = parseDateHe(text);
      if (!departDate) {
        return "לא הבנתי את התאריך 🤔 נסו בפורמט DD/MM/YYYY, למשל 15/09/2026";
      }
      await setConversation(chatId, {
        ...state,
        departDate,
        step: "awaiting_return",
        updatedAt: now,
      });
      return "ותאריך חזרה? (או שלחו 'הלוך' לכרטיס חד-כיווני)";
    }

    case "awaiting_return": {
      let returnDate: string | null = null;
      if (!isOneWayAnswer(text)) {
        returnDate = parseDateHe(text);
        if (!returnDate) {
          return "לא הבנתי את התאריך 🤔 נסו DD/MM/YYYY, או שלחו 'הלוך' לכרטיס חד-כיווני";
        }
      }

      const reply = await formatResultsReply({
        origin: state.origin!,
        destination: state.destination!,
        departDate: state.departDate!,
        returnDate,
      });
      await clearConversation(chatId);
      return reply;
    }

    default:
      await clearConversation(chatId);
      return "משהו השתבש 🤔 אפשר להתחיל שוב עם 'טיסה'.";
  }
}
