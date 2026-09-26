import { NextResponse } from "next/server";
import { getBgnFlightsSnapshot } from "@/lib/tlv-control/providers/bgn-flights";
import { searchFlights } from "@/lib/tlv-control/utils/flight-search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";
  const snapshot = await getBgnFlightsSnapshot(force);

  const flightNumber = searchParams.get("flightNumber")?.trim() || undefined;
  const destination = searchParams.get("destination")?.trim() || undefined;
  const airline = searchParams.get("airline")?.trim() || undefined;
  const date = searchParams.get("date")?.trim() || undefined;

  if (flightNumber || destination || airline || date) {
    const results = searchFlights(snapshot.flights, { flightNumber, destination, airline, date });
    return NextResponse.json(
      { ...snapshot, flights: results, arrivals: results.filter((f) => f.direction === "arrival"), departures: results.filter((f) => f.direction === "departure") },
      { status: snapshot.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(snapshot, {
    status: snapshot.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
