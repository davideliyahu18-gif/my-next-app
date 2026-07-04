import { existsSync, watch } from "node:fs";
import { dirname } from "node:path";
import {
  WHATSAPP_FEED_INITIAL_LIMIT,
} from "@/lib/constants";
import { getWebsiteFeedPath, readFeedMessages, readFeedTail } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseEncode(event: string, data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const feedPath = getWebsiteFeedPath();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let byteOffset = 0;
      let watcher: ReturnType<typeof watch> | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        watcher?.close();
        if (pollTimer) clearInterval(pollTimer);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      const pushTail = () => {
        const { messages, byteOffset: nextOffset } = readFeedTail(byteOffset);
        byteOffset = nextOffset;

        for (const message of messages) {
          controller.enqueue(sseEncode("feed", message));
        }
      };

      const { messages, byteOffset: currentSize } = readFeedMessages({
        limit: WHATSAPP_FEED_INITIAL_LIMIT,
      });
      byteOffset = currentSize;
      controller.enqueue(sseEncode("init", { messages }));

      if (feedPath && existsSync(feedPath)) {
        try {
          watcher = watch(feedPath, { persistent: false }, () => {
            if (!closed) pushTail();
          });
        } catch {
          // Fall back to polling only.
        }

        const feedDir = dirname(feedPath);
        if (feedDir && feedDir !== feedPath) {
          try {
            watch(feedDir, { persistent: false }, (_event, filename) => {
              if (!closed && filename === "website_feed.jsonl") {
                pushTail();
              }
            });
          } catch {
            // Polling covers this case.
          }
        }
      }

      pollTimer = setInterval(() => {
        if (!closed) pushTail();
      }, 1000);

      controller.enqueue(sseEncode("ready", { ok: true }));

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
