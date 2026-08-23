"use client";

import { useCallback, useEffect, useState } from "react";
import { FIFA_LIVE_POLL_MS } from "@/lib/constants";
import type { LeaguesDashboardView } from "@/lib/football/leagues-data";
import FeedNews from "./FeedNews";
import ChampionsLeagueSection from "./ChampionsLeagueSection";
import LeagueMatchesPanel from "./LeagueMatchesPanel";
import LeagueNextMatch from "./LeagueNextMatch";
import LeagueStandingsSection from "./LeagueStandingsSection";
import SocialBar from "./SocialBar";

export default function LeaguesDashboard({
  initial,
}: {
  initial: LeaguesDashboardView;
}) {
  const [data, setData] = useState(initial);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/leagues/dashboard", { cache: "no-store" });
      if (!response.ok) return;
      const dashboard = (await response.json()) as LeaguesDashboardView;
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

  const liveCount = data.liveMatches.length;

  return (
    <>
      <div className="mb-5 flex items-center justify-end gap-2 text-[11px] text-zinc-500">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            syncing ? "animate-pulse bg-amber-400" : "bg-success"
          }`}
        />
        נתוני 365scores · עודכן{" "}
        {new Date(data.fetchedAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jerusalem",
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-3">
          <LeagueNextMatch match={data.nextMatch} liveCount={liveCount} />
          <SocialBar />
        </aside>

        <div className="lg:col-span-6">
          <LeagueMatchesPanel
            leagues={data.leagues}
            matchesByLeague={data.matchesByLeague}
            liveMatches={data.liveMatches}
          />
        </div>

        <aside className="space-y-6 lg:col-span-3">
          <FeedNews />
        </aside>
      </div>

      <LeagueStandingsSection standings={data.standings} />
      <ChampionsLeagueSection data={data.championsLeague} />
    </>
  );
}
