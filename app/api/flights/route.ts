import { NextResponse } from "next/server";
import {
  getFlightsSnapshot,
  parseFlightDayScope,
} from "@/lib/flights/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";
  const dayScope = parseFlightDayScope(searchParams.get("day"));
  const snapshot = await getFlightsSnapshot({ force, dayScope });

  return NextResponse.json(snapshot, {
    status: snapshot.ok || snapshot.flights.length > 0 ? 200 : 502,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
