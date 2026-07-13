"use client";

import { useCallback, useEffect, useState } from "react";
import { FIFA_LIVE_POLL_MS } from "@/lib/constants";
import type { FifaDashboardView } from "@/lib/types";
import CompactScorersPanel from "./CompactScorersPanel";
import FeedNews from "./FeedNews";
import LeadingStatsPanel from "./LeadingStatsPanel";
import LiveMatchesPanel from "./LiveMatchesPanel";
import NextMatch from "./NextMatch";
import SocialBar from "./SocialBar";
import StandingsPanel from "./StandingsPanel";

export default function FifaDashboard({ initial }: { initial: FifaDashboardView }) {
  const [data, setData] = useState(initial);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/fifa/dashboard", { cache: "no-store" });
      if (!response.ok) return;
      const dashboard = (await response.json()) as FifaDashboardView;
      setData(dashboard);
    } catch {
      // Keep last good snapshot on transient network errors.
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, FIFA_LIVE_POLL_MS);

    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <>
      <div className="mb-5 flex items-center justify-end gap-2 text-[11px] text-zinc-500">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            syncing ? "animate-pulse bg-amber-400" : "bg-success"
          }`}
        />
        נתוני FIFA · עודכן{" "}
        {new Date(data.fetchedAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jerusalem",
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-3" id="scorers">
          <CompactScorersPanel scorers={data.scorers} />
          <NextMatch match={data.nextMatch} />
          <SocialBar />
        </aside>

        <div className="lg:col-span-6">
          <LiveMatchesPanel matches={data.matches} />
        </div>

        <aside className="space-y-6 lg:col-span-3">
          <StandingsPanel standings={data.standings} compact />
          <FeedNews />
        </aside>
      </div>

      <LeadingStatsPanel scorers={data.scorers} />
    </>
  );
}
