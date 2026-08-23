"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FIFA_LIVE_POLL_MS } from "@/lib/constants";
import type { LiveMatchCenterView, MatchEventView } from "@/lib/football/match-center";
import MatchPitch from "./MatchPitch";
import TeamCrest from "./TeamCrest";

type TabId = "pitch" | "timeline" | "lineups";

function eventIcon(kind: MatchEventView["kind"]): string {
  if (kind === "goal") return "⚽";
  if (kind === "yellow") return "🟨";
  if (kind === "red") return "🟥";
  if (kind === "sub") return "🔄";
  return "•";
}

function TeamBlock({
  team,
  align,
}: {
  team: LiveMatchCenterView["home"];
  align: "home" | "away";
}) {
  const content = (
    <>
      <TeamCrest src={team.logo} name={team.name} size={40} />
      <span className="mt-2 line-clamp-2 text-center text-sm font-bold text-white">
        {team.name}
      </span>
      {team.slug ? (
        <span className="mt-1 text-[10px] text-gold/80">פרופיל קבוצה</span>
      ) : null}
    </>
  );

  if (!team.slug) {
    return (
      <div
        className={`flex flex-col items-center ${align === "away" ? "order-3" : "order-1"}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/club/${team.slug}`}
      className={`flex flex-col items-center transition-opacity hover:opacity-90 ${align === "away" ? "order-3" : "order-1"}`}
    >
      {content}
    </Link>
  );
}

export default function LiveMatchCenter({
  initial,
}: {
  initial: LiveMatchCenterView;
}) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<TabId>("pitch");
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/match/${data.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as LiveMatchCenterView;
      setData(next);
    } catch {
      // keep last snapshot
    } finally {
      setSyncing(false);
    }
  }, [data.id]);

  useEffect(() => {
    if (data.status !== "live") return;
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, FIFA_LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [data.status, refresh]);

  const score =
    data.home.score !== null && data.away.score !== null
      ? `${data.home.score} - ${data.away.score}`
      : "VS";

  const tabs: { id: TabId; label: string }[] = [
    { id: "pitch", label: "מגרש" },
    { id: "timeline", label: "ציר זמן" },
    { id: "lineups", label: "הרכבים" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/[0.08] bg-card p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-gold">
            {data.leagueFlag} {data.leagueName}
          </p>
          {data.status === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live/20 px-2.5 py-1 text-[10px] font-black text-red-300">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
              LIVE {data.minute}
            </span>
          ) : (
            <span className="text-xs text-zinc-500">{data.statusLabel}</span>
          )}
        </div>

        <div className="grid grid-cols-3 items-center gap-3">
          <TeamBlock team={data.home} align="home" />
          <div className="order-2 text-center">
            <p className="text-4xl font-black tabular-nums text-white md:text-5xl">
              {score}
            </p>
            {data.status === "live" && (
              <p className="mt-1 text-sm font-bold text-zinc-400">{data.minute}</p>
            )}
          </div>
          <TeamBlock team={data.away} align="away" />
        </div>

        <div className="mt-5 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                tab === item.id
                  ? "bg-gold/15 text-gold"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "pitch" && (
            <MatchPitch
              isLive={data.status === "live"}
              minute={data.minute}
              lastEventLabel={
                data.lastEvent
                  ? `${data.lastEvent.label}${data.lastEvent.playerName ? ` · ${data.lastEvent.playerName}` : ""}`
                  : null
              }
              lastEventTeam={data.lastEvent?.teamName ?? null}
            />
          )}

          {tab === "timeline" && (
            <div className="space-y-2">
              {data.events.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">
                  אין אירועים עדיין
                </p>
              ) : (
                [...data.events].reverse().map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3"
                  >
                    <span className="w-10 shrink-0 text-center text-xs font-black text-gold">
                      {event.minute}
                    </span>
                    <span className="text-lg">{eventIcon(event.kind)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {event.label}
                        {event.playerName ? ` · ${event.playerName}` : ""}
                      </p>
                      <p className="text-xs text-zinc-500">{event.teamName}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "lineups" && (
            <div className="grid gap-4 md:grid-cols-2">
              {(["home", "away"] as const).map((side) => (
                <div
                  key={side}
                  className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"
                >
                  <p className="mb-3 text-sm font-bold text-gold">
                    {side === "home" ? data.home.name : data.away.name}
                  </p>
                  {data.lineups[side].length === 0 ? (
                    <p className="text-sm text-zinc-500">הרכב לא פורסם עדיין</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.lineups[side].map((player) => (
                        <li
                          key={`${side}-${player.number}-${player.name}`}
                          className="flex items-center gap-2 text-sm text-zinc-200"
                        >
                          <span className="w-6 text-center text-xs font-black text-zinc-500">
                            {player.number ?? "—"}
                          </span>
                          <span className="truncate">{player.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-600">
          {syncing ? "מעדכן…" : "נתוני 365scores"}
          {data.status === "live" ? " · רענון אוטומטי" : ""}
        </p>
      </div>
    </div>
  );
}
