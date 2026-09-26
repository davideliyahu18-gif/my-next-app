import type { BgnFlight, FlightSearchQuery } from "../types";

export function searchFlights(flights: BgnFlight[], query: FlightSearchQuery): BgnFlight[] {
  return flights.filter((f) => {
    if (query.flightNumber && !f.flightNumber.toUpperCase().includes(query.flightNumber.toUpperCase())) {
      return false;
    }
    if (query.airline) {
      const airline = query.airline.toUpperCase();
      if (!f.airlineName.toUpperCase().includes(airline) && !f.airlineCode.toUpperCase().includes(airline)) {
        return false;
      }
    }
    if (query.destination) {
      const dest = query.destination.toUpperCase();
      const matches =
        f.otherAirportCode?.toUpperCase().includes(dest) ||
        f.otherAirportNameHe?.includes(query.destination) ||
        f.otherAirportNameEn?.toUpperCase().includes(dest) ||
        f.countryHe?.includes(query.destination);
      if (!matches) return false;
    }
    if (query.date) {
      if (!f.scheduledAt || !f.scheduledAt.startsWith(query.date)) return false;
    }
    return true;
  });
}

/** Matches a live aircraft's callsign to a scheduled flight number, but only
 * when the identifiers line up closely enough to be confident — never a
 * fuzzy guess. Airline callsigns are typically the ICAO airline code plus
 * the flight number (e.g. "ELY001"), which the IATA-style flight number in
 * the BGN feed ("LY001") won't match textually, so this checks the numeric
 * flight-number suffix plus a same-length-or-longer alphabetic prefix. */
export function matchesCallsign(flight: BgnFlight, callsign: string | null): boolean {
  if (!callsign) return false;
  const cs = callsign.trim().toUpperCase();
  const flightDigits = flight.flightNumber.replace(/\D/g, "");
  const csDigits = cs.replace(/\D/g, "");
  if (!flightDigits || !csDigits) return false;
  // Require the full numeric portion to match exactly (not just a suffix),
  // and require at least one shared leading letter (airline code overlap).
  const flightLetters = flight.flightNumber.replace(/\d/g, "");
  const csLetters = cs.replace(/\d/g, "");
  return flightDigits === csDigits && flightLetters.length > 0 && csLetters.startsWith(flightLetters[0]);
}
