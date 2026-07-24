import { getRocketsSnapshot, ROCKETS_POLL_MS } from "@/lib/rockets/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET() {
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (closed) return;
        const snapshot = await getRocketsSnapshot({ allowDemoFallback: true });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`),
        );
      };

      await send();

      while (!closed) {
        await new Promise((resolve) => setTimeout(resolve, ROCKETS_POLL_MS));
        await send();
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
