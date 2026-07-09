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

function badgeFromBody(body: string): { label: string; className: string } {
  if (/שער|GOAL|⚽/i.test(body)) {
    return { label: "שער", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
  }
  if (/VAR|וידאו/i.test(body)) {
    return { label: "VAR", className: "bg-sky-500/15 text-sky-400 border-sky-500/25" };
  }
  if (/צהוב|🟨/i.test(body)) {
    return { label: "כרטיס", className: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
  }
  if (/אדום|🟥/i.test(body)) {
    return { label: "אדום", className: "bg-red-500/15 text-red-400 border-red-500/25" };
  }
  return { label: "עדכון", className: "bg-gold/10 text-gold border-gold/25" };
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
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "bg-success animate-live-pulse" : "bg-amber-500"
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
            latest.map((message) => {
              const badge = badgeFromBody(message.body);
              return (
                <article
                  key={message.id}
                  className="flex gap-3 px-5 py-4 transition-colors hover:bg-white/[0.02]"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-[11px] font-black ${badge.className}`}
                  >
                    {badge.label}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                      {headlineFromBody(message.body)}
                    </p>
                    <time
                      dateTime={message.sentAt}
                      className="mt-1.5 block text-[11px] text-zinc-500"
                    >
                      {formatFeedTimestamp(message.sentAt)}
                    </time>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </DashboardCard>
    </section>
  );
}
