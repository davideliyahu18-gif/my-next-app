import { getLiveMatches } from "@/lib/api";
import type { LiveMatchView } from "@/lib/types";
import GlassCard from "./GlassCard";
import SectionHeader from "./SectionHeader";

function TeamBlock({
  flag,
  name,
  align = "right",
}: {
  flag: string;
  name: string;
  align?: "right" | "left";
}) {
  return (
    <div
      className={`flex flex-1 flex-col gap-2 ${align === "right" ? "items-center text-center" : "items-center text-center"}`}
    >
      <span className="text-4xl transition-transform duration-500 group-hover:scale-110 md:text-5xl">
        {flag}
      </span>
      <span className="max-w-[80px] truncate text-xs font-bold text-white md:text-sm">
        {name}
      </span>
    </div>
  );
}

function ScoreBlock({
  homeScore,
  awayScore,
  minute,
  isLive,
}: {
  homeScore: number | null;
  awayScore: number | null;
  minute: string;
  isLive: boolean;
}) {
  const score =
    homeScore !== null && awayScore !== null
      ? `${homeScore} - ${awayScore}`
      : "VS";

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 px-2">
      <span
        className={`text-3xl font-black tabular-nums tracking-tighter md:text-4xl ${isLive ? "text-white" : "text-zinc-500"}`}
      >
        {score}
      </span>
      <span
        className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${isLive ? "bg-red-500/20 text-red-300" : "bg-zinc-800 text-zinc-400"}`}
      >
        {minute}
      </span>
    </div>
  );
}

function LiveMatchCard({
  match,
  index,
}: {
  match: LiveMatchView;
  index: number;
}) {
  const isLive = match.status === "live";

  return (
    <GlassCard
      className={`group relative min-w-[280px] shrink-0 overflow-hidden p-0 sm:min-w-0 ${isLive ? "ring-1 ring-red-500/20" : ""}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {isLive && (
        <>
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-red-500 via-red-400 to-transparent" />
          <span className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-[10px] font-black tracking-widest text-white shadow-lg shadow-red-500/30">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            LIVE
          </span>
        </>
      )}

      <div className="border-b border-white/5 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {match.league}
        </p>
      </div>

      <div className="px-5 py-6">
        <div className="flex items-center justify-between gap-3">
          <TeamBlock flag={match.homeFlag} name={match.home} />
          <ScoreBlock
            homeScore={match.homeScore}
            awayScore={match.awayScore}
            minute={match.minute}
            isLive={isLive}
          />
          <TeamBlock flag={match.awayFlag} name={match.away} align="left" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 bg-black/20 px-5 py-3 text-[11px] text-zinc-500">
        <span>{match.venue}</span>
        {isLive && (
          <span className="font-bold text-red-400">{match.minute}</span>
        )}
      </div>
    </GlassCard>
  );
}

export default async function LiveMatches() {
  const liveMatches = await getLiveMatches();

  return (
    <section id="matches">
      <SectionHeader
        title="משחקים חיים"
        subtitle="תוצאות בזמן אמת מכל האצטדיונים"
        action="כל המשחקים"
      />
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-2 xl:grid-cols-2">
        {liveMatches.map((match, i) => (
          <LiveMatchCard key={match.id} match={match} index={i} />
        ))}
      </div>
    </section>
  );
}
