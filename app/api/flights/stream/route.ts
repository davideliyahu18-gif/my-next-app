import { FLIGHTS_STREAM_INTERVAL_MS } from "@/lib/flights/constants";
import {
  getFlightsSnapshot,
  parseFlightDayScope,
} from "@/lib/flights/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayScope = parseFlightDayScope(searchParams.get("day"));
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async (force = false) => {
        if (closed) return;
        const snapshot = await getFlightsSnapshot({ force, dayScope });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`),
        );
      };

      await send(true);

      while (!closed) {
        await new Promise((resolve) =>
          setTimeout(resolve, FLIGHTS_STREAM_INTERVAL_MS),
        );
        await send(false);
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
