import { getRocketsSnapshot } from "@/lib/rockets/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getRocketsSnapshot({ allowDemoFallback: true });
  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
