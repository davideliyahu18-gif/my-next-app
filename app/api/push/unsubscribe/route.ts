import { NextResponse } from "next/server";
import { removePushSubscriber } from "@/lib/push/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }
    await removePushSubscriber(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unsubscribe failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
