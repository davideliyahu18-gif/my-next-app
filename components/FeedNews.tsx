"use client";

import { useEffect, useState } from "react";
import type { WhatsAppFeedMessage } from "@/lib/types";
import { formatFeedTimestamp } from "@/lib/utils";
import DashboardCard from "./DashboardCard";

function mergeMessages(
  existing: WhatsAppFeedMessage[],
  incoming: WhatsAppFeedMessage[],
): WhatsAppFeedMessage[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
}

function headlineFromBody(body: string): string {
  const line = body.split("\n").find((part) => part.trim())?.trim() ?? body;
  return line.length > 72 ? `${line.slice(0, 69)}…` : line;
}

export default function FeedNews() {
  const [messages, setMessages] = useState<WhatsAppFeedMessage[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/messages/stream");

    source.addEventListener("init", (event) => {
      const payload = JSON.parse(event.data) as { messages: WhatsAppFeedMessage[] };
      setMessages(mergeMessages([], payload.messages));
    });

    source.addEventListener("feed", (event) => {
      const message = JSON.parse(event.data) as WhatsAppFeedMessage;
      setMessages((current) => mergeMessages(current, [message]));
    });

    source.addEventListener("ready", () => setConnected(true));
    source.onerror = () => setConnected(false);

    return () => source.close();
  }, []);

  const latest = messages.slice(0, 3);

  return (
    <section id="news">
      <DashboardCard
        title="חדשות אחרונות"
        badge={
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "bg-emerald-400" : "bg-amber-500"
              }`}
            />
            {connected ? "חי" : "מתחבר"}
          </span>
        }
      >
        <div className="divide-y divide-white/[0.04]">
          {latest.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              ממתין לעדכונים מ-WhatsApp…
            </p>
          ) : (
            latest.map((message) => (
              <article key={message.id} className="flex gap-3 px-5 py-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-xl">
                  ⚽
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                    {headlineFromBody(message.body)}
                  </p>
                  <time
                    dateTime={message.sentAt}
                    className="mt-1 block text-[11px] text-zinc-500"
                  >
                    {formatFeedTimestamp(message.sentAt)}
                  </time>
                </div>
              </article>
            ))
          )}
        </div>
      </DashboardCard>
    </section>
  );
}
