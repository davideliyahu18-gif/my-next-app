import { NextResponse } from "next/server";
import { amadeusConfigured } from "@/lib/flight-deals/amadeus";
import { FLIGHT_DEALS_MAX_PRICE_USD, FLIGHT_DEALS_ORIGIN } from "@/lib/flight-deals/constants";
import { isNotificationConfigured } from "@/lib/flight-deals/notify";
import { listRecentDeals } from "@/lib/flight-deals/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const deals = await listRecentDeals(50);

  return NextResponse.json({
    ok: true,
    origin: FLIGHT_DEALS_ORIGIN,
    maxPriceUsd: FLIGHT_DEALS_MAX_PRICE_USD,
    amadeusConfigured: amadeusConfigured(),
    notificationConfigured: isNotificationConfigured(),
    deals,
    timestamp: new Date().toISOString(),
  });
}
