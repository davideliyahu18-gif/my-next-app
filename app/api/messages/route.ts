import { readFeedMessages } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { messages } = await readFeedMessages();

  return Response.json({ messages });
}
