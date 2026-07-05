import { getFifaDashboardLive } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const dashboard = await getFifaDashboardLive();

  return Response.json(dashboard, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
