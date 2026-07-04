import { WHATSAPP_FEED_INITIAL_LIMIT } from "@/lib/constants";
import { readFeedMessages, readFeedTail } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseEncode(event: string, data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let cursor = 0;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      const pushTail = async () => {
        if (closed) return;

        const tail = await readFeedTail(cursor);
        cursor = tail.cursor;

        for (const message of tail.messages) {
          controller.enqueue(sseEncode("feed", message));
        }
      };

      void (async () => {
        const initial = await readFeedMessages({
          limit: WHATSAPP_FEED_INITIAL_LIMIT,
        });
        cursor = initial.cursor;
        controller.enqueue(sseEncode("init", { messages: initial.messages }));

        pollTimer = setInterval(() => {
          void pushTail();
        }, 1000);

        controller.enqueue(sseEncode("ready", { ok: true }));
      })();

      request.signal.addEventListener("abort", close);
    },
    cancel() {
      // Abort listener handles cleanup when the client disconnects.
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
