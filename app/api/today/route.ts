import { getTodaysMatchesLive } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const todays = await getTodaysMatchesLive();
  return Response.json(todays);
}
