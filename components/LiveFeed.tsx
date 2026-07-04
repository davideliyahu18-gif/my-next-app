"use client";

import { useEffect, useRef, useState } from "react";
import type { WhatsAppFeedMessage } from "@/lib/types";
import { formatFeedTimestamp } from "@/lib/utils";
import GlassCard from "./GlassCard";
import SectionHeader from "./SectionHeader";

function mergeMessages(
  existing: WhatsAppFeedMessage[],
  incoming: WhatsAppFeedMessage[],
): WhatsAppFeedMessage[] {
  const byId = new Map(existing.map((message) => [message.id, message]));

  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );
}

export default function LiveFeed() {
  const [messages, setMessages] = useState<WhatsAppFeedMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const source = new EventSource("/api/messages/stream");

    source.addEventListener("init", (event) => {
      const payload = JSON.parse(event.data) as { messages: WhatsAppFeedMessage[] };
      setMessages(payload.messages);
    });

    source.addEventListener("feed", (event) => {
      const message = JSON.parse(event.data) as WhatsAppFeedMessage;
      setMessages((current) => mergeMessages(current, [message]));
    });

    source.addEventListener("ready", () => {
      setConnected(true);
    });

    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const element = listRef.current;
    if (!element) return;

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  return (
    <section id="news" className="py-4">
      <SectionHeader
        title="עדכונים חיים"
        subtitle="הודעות WhatsApp בזמן אמת — אותן הודעות שנשלחות לקבוצה, ללא שינוי"
      />

      <GlassCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <span
              className={`h-2 w-2 rounded-full ${
                connected
                  ? "animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-amber-500"
              }`}
            />
            {connected ? "מחובר לזרם חי" : "מתחבר..."}
          </div>
          <span className="text-[11px] text-zinc-500">
            {messages.length} הודעות
          </span>
        </div>

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="max-h-[640px] space-y-3 overflow-y-auto p-4 md:p-5"
        >
          {messages.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              ממתין להודעות WhatsApp… כל התראה (שערים, VAR, כרטיסים, הרכבים
              ועוד) תופיע כאן מיד כשהיא נשלחת.
            </p>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 transition-colors hover:border-amber-400/20"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold tracking-wider text-amber-400">
                    WhatsApp
                  </span>
                  <time
                    dateTime={message.sentAt}
                    className="text-[11px] text-zinc-500"
                  >
                    {formatFeedTimestamp(message.sentAt)}
                  </time>
                </div>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-100">
                  {message.body}
                </pre>
              </article>
            ))
          )}
        </div>
      </GlassCard>
    </section>
  );
}
