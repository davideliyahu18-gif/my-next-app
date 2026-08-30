import { NextResponse } from "next/server";
import { isAmadeusConfigured } from "@/lib/amadeus/auth";
import { searchHotelPrices } from "@/lib/amadeus/hotels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAmadeusConfigured()) {
    return NextResponse.json({ ok: false, configured: false, offers: null });
  }

  const { searchParams } = new URL(request.url);
  const city = (searchParams.get("city") || "").trim();
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";

  if (!city || !checkIn || !checkOut) {
    return NextResponse.json(
      { ok: false, error: "city, checkIn and checkOut are required" },
      { status: 400 },
    );
  }

  try {
    const offers = await searchHotelPrices({ city, checkIn, checkOut });
    return NextResponse.json(
      { ok: true, configured: true, offers },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "hotel price search failed";
    return NextResponse.json({ ok: false, configured: true, error: message }, { status: 502 });
  }
}
