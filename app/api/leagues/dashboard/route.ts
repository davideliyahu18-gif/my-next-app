import { getLeaguesDashboardLive } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await getLeaguesDashboardLive();
  return Response.json(dashboard);
}
