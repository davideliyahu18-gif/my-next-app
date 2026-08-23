"use client";

import { useState } from "react";
import type { LeagueStandingsView } from "@/lib/football/leagues-data";
import { formatGoalDifference } from "@/lib/utils";
import DashboardCard from "./DashboardCard";
import TeamCrest from "./TeamCrest";

function StandingsTable({ table }: { table: LeagueStandingsView }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.06] text-[11px] text-zinc-500">
          <th className="px-4 py-2.5 text-right font-semibold">#</th>
          <th className="px-2 py-2.5 text-right font-semibold">קבוצה</th>
          <th className="px-2 py-2.5 text-center font-semibold">מש&apos;</th>
          <th className="px-2 py-2.5 text-center font-semibold">נצ&apos;</th>
          <th className="px-2 py-2.5 text-center font-semibold">ת&apos;</th>
          <th className="px-2 py-2.5 text-center font-semibold">+/-</th>
          <th className="px-4 py-2.5 text-center font-semibold">נק&apos;</th>
        </tr>
      </thead>
      <tbody>
        {table.rows.map((team, index) => (
          <tr
            key={`${team.rank}-${team.teamName}`}
            className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-gold/[0.04]"
          >
            <td className="px-4 py-3 text-right">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                  index < 3 ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-500"
                }`}
              >
                {team.rank}
              </span>
            </td>
            <td className="px-2 py-3 font-semibold text-white">
              <span className="inline-flex min-w-0 items-center gap-2">
                <TeamCrest src={team.teamLogo} name={team.teamName} size={20} />
                <span className="truncate">{team.teamName}</span>
              </span>
            </td>
            <td className="px-2 py-3 text-center text-zinc-400">{team.played}</td>
            <td className="px-2 py-3 text-center text-zinc-400">{team.won}</td>
            <td className="px-2 py-3 text-center text-zinc-400">{team.drawn}</td>
            <td
              className={`px-2 py-3 text-center text-xs font-bold ${
                team.gd > 0
                  ? "text-emerald-400"
                  : team.gd < 0
                    ? "text-red-400"
                    : "text-zinc-500"
              }`}
            >
              {formatGoalDifference(team.gd)}
            </td>
            <td className="px-4 py-3 text-center text-base font-black text-gold">
              {team.points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LeagueStandingsSection({
  standings,
}: {
  standings: LeagueStandingsView[];
}) {
  const [activeSlug, setActiveSlug] = useState(standings[0]?.leagueSlug ?? "");
  const activeTable =
    standings.find((table) => table.leagueSlug === activeSlug) ?? standings[0];

  return (
    <section id="standings" className="mt-10 animate-fade-up">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">טבלאות ליגות</h2>
          <p className="mt-1 text-sm text-zinc-500">מעודכן מ-365scores לפי קטגוריה</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <DashboardCard title="בחר ליגה">
            <div className="divide-y divide-white/[0.05]">
              {standings.map((table) => {
                const active = table.leagueSlug === activeSlug;
                const leader = table.rows[0];
                return (
                  <button
                    key={table.leagueSlug}
                    type="button"
                    onClick={() => setActiveSlug(table.leagueSlug)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-right transition-colors ${
                      active ? "bg-gold/10" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-bold ${active ? "text-gold" : "text-white"}`}>
                        {table.leagueFlag} {table.leagueName}
                      </p>
                      {leader && (
                        <p className="mt-1 text-xs text-zinc-500">
                          מובילה: {leader.teamName} ({leader.points} נק&apos;)
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-600">{table.rows.length} קבוצות</span>
                  </button>
                );
              })}
            </div>
          </DashboardCard>
        </div>

        <div className="lg:col-span-8">
          {activeTable ? (
            <DashboardCard
              title={`טבלה — ${activeTable.leagueName}`}
              badge={
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">
                  365scores
                </span>
              }
            >
              {activeTable.rows.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-zinc-500">
                  אין נתוני טבלה לליגה הזו כרגע
                </p>
              ) : (
                <StandingsTable table={activeTable} />
              )}
            </DashboardCard>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {standings.map((table) => (
          <DashboardCard
            key={table.leagueSlug}
            title={`${table.leagueFlag} ${table.leagueName}`}
            badge={
              <span className="text-[10px] font-semibold text-zinc-500">TOP 5</span>
            }
          >
            {table.rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-500">אין נתונים</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {table.rows.slice(0, 5).map((team) => (
                    <tr
                      key={`${table.leagueSlug}-${team.teamName}`}
                      className="border-b border-white/[0.03] last:border-0"
                    >
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-zinc-500">
                        {team.rank}
                      </td>
                      <td className="px-2 py-2.5 font-semibold text-white">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <TeamCrest
                            src={team.teamLogo}
                            name={team.teamName}
                            size={18}
                          />
                          <span className="truncate">{team.teamName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-black text-gold">
                        {team.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DashboardCard>
        ))}
      </div>
    </section>
  );
}
