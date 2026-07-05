import { getFifaDashboard } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await getFifaDashboard();

  return Response.json(dashboard, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
