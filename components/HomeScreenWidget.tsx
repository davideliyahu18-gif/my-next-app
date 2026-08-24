"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FIFA_LIVE_POLL_MS } from "@/lib/constants";
import type { LeagueMatchView, TodaysMatchesView } from "@/lib/football/leagues-data";
import TeamCrest from "./TeamCrest";

function WidgetMatchRow({ match }: { match: LeagueMatchView }) {
  const isLive = match.status === "live";
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore}-${match.awayScore}`
      : match.timeLabel;

  return (
    <Link
      href={`/match/${match.id}`}
      className={`flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 last:border-0 ${
        isLive ? "bg-live/[0.08]" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] text-zinc-500">
          {match.leagueFlag} {match.leagueName}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-bold text-white">
          <TeamCrest src={match.homeLogo} name={match.home} size={14} />
          <span className="truncate">{match.home}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-bold text-white">
          <TeamCrest src={match.awayLogo} name={match.away} size={14} />
          <span className="truncate">{match.away}</span>
        </p>
      </div>
      <div className="shrink-0 text-left">
        {isLive ? (
          <span className="mb-1 block text-center text-[9px] font-black text-red-300">
            LIVE {match.minute}
          </span>
        ) : null}
        <p
          className={`text-sm font-black tabular-nums ${
            isLive ? "text-white" : "text-gold"
          }`}
        >
          {score}
        </p>
      </div>
    </Link>
  );
}

export default function HomeScreenWidget({
  initial,
}: {
  initial: TodaysMatchesView;
}) {
  const [data, setData] = useState(initial);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/today", { cache: "no-store" });
      if (!response.ok) return;
      setData((await response.json()) as TodaysMatchesView);
    } catch {
      // keep snapshot
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

  const live = data.matches.filter((match) => match.status === "live");
  const upcoming = data.matches.filter((match) => match.status === "upcoming");
  const finished = data.matches.filter((match) => match.status === "finished");
  const shown = [...live, ...upcoming, ...finished].slice(0, 8);

  return (
    <div
      dir="rtl"
      className="mx-auto min-h-screen max-w-md bg-background px-3 py-4 text-foreground"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-gold">
            ווידג׳ט חי
          </p>
          <h1 className="text-lg font-black text-white">
            {data.dayLabel || "משחקי היום"}
          </h1>
        </div>
        <div className="text-left text-[10px] text-zinc-500">
          {data.liveCount > 0 ? (
            <span className="font-black text-red-300">{data.liveCount} LIVE</span>
          ) : (
            <span>{syncing ? "מעדכן…" : "מעודכן"}</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            אין משחקים היום כרגע
          </p>
        ) : (
          shown.map((match) => <WidgetMatchRow key={match.id} match={match} />)
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href="/today"
          className="flex-1 rounded-full border border-gold/30 bg-gold/10 py-2.5 text-center text-xs font-bold text-gold"
        >
          כל משחקי היום
        </Link>
        <Link
          href="/"
          className="flex-1 rounded-full border border-white/10 bg-white/[0.03] py-2.5 text-center text-xs font-bold text-zinc-300"
        >
          לאתר המלא
        </Link>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-500">
        כדי לשמור כווידג׳ט במסך הבית: פתחו את העמוד הזה ← שתף / תפריט ←
        <span className="text-zinc-300"> הוסף למסך הבית</span>
      </p>
    </div>
  );
}
