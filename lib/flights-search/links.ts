import { CITY_IATA } from "./constants";
import type { FlightSearchLinks } from "./types";

function resolveIata(place: string): string | null {
  return CITY_IATA[place.trim().toLowerCase()] ?? null;
}

/** yyMMdd, the path segment format Skyscanner's search-results URL expects. */
function toSkyscannerDateSegment(isoDate: string): string {
  return isoDate.replace(/-/g, "").slice(2);
}

export function buildGoogleFlightsUrl(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
}): string {
  const query = input.returnDate
    ? `Flights from ${input.origin} to ${input.destination} on ${input.departDate} through ${input.returnDate}`
    : `Flights from ${input.origin} to ${input.destination} on ${input.departDate}`;

  const url = new URL("https://www.google.com/travel/flights");
  url.searchParams.set("q", query);
  return url.toString();
}

export function buildSkyscannerUrl(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
}): string | null {
  const originIata = resolveIata(input.origin);
  const destIata = resolveIata(input.destination);
  if (!originIata || !destIata) return null;

  const depart = toSkyscannerDateSegment(input.departDate);
  const back = input.returnDate ? toSkyscannerDateSegment(input.returnDate) : "";

  return `https://www.skyscanner.net/transport/flights/${originIata.toLowerCase()}/${destIata.toLowerCase()}/${depart}/${back}/?adultsv2=1&cabinclass=economy`;
}

export function buildFlightLinks(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
}): FlightSearchLinks {
  return {
    googleFlightsUrl: buildGoogleFlightsUrl(input),
    skyscannerUrl: buildSkyscannerUrl(input),
  };
}
