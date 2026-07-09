import Link from "next/link";
import type { LiveMatchView } from "@/lib/types";
import DashboardCard from "./DashboardCard";
import HighlightButton from "./HighlightButton";

function parseMinuteProgress(minute: string): number {
  if (minute === "HT" || minute === "הפסקה" || minute === "סיום") return 50;
  const numeric = Number.parseInt(minute, 10);
  if (Number.isNaN(numeric)) return 0;
  return Math.min((numeric / 90) * 100, 100);
}

function MinuteRing({ minute, isLive }: { minute: string; isLive: boolean }) {
  const progress = parseMinuteProgress(minute);
  const circumference = 2 * Math.PI * 18;

  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="3"
        />
        {isLive && (
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke={progress > 60 ? "#eab308" : "#22c55e"}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (progress / 100) * circumference}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="text-[10px] font-bold text-zinc-300">{minute}</span>
    </div>
  );
}

function MatchRow({ match }: { match: LiveMatchView }) {
  const isLive = match.status === "live";
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} - ${match.awayScore}`
      : "VS";

  return (
    <div
      className={`group flex items-center gap-3 border-b border-white/[0.05] px-5 py-5 last:border-0 transition-colors ${
        isLive
          ? "bg-gradient-to-l from-live/[0.08] via-transparent to-transparent"
          : "hover:bg-white/[0.02]"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Link
          href={`/teams/${match.homeCode.toLowerCase()}`}
          className="flex min-w-0 items-center gap-2.5 transition-colors hover:text-gold"
        >
          <span className="text-2xl drop-shadow-sm">{match.homeFlag}</span>
          <span className="truncate text-sm font-bold text-white md:text-base">
            {match.home}
          </span>
        </Link>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1.5 px-2">
        <span
          className={`text-xl font-black tabular-nums tracking-wide md:text-2xl ${
            isLive ? "text-white" : "text-zinc-200"
          }`}
        >
          {score}
        </span>
        {isLive ? (
          <div className="flex flex-col items-center gap-1">
            <span className="flex items-center gap-1 rounded-full bg-live/20 px-2 py-0.5 text-[9px] font-black tracking-wider text-red-300">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
              LIVE
            </span>
            <span className="text-[10px] font-bold text-zinc-400">{match.minute}</span>
          </div>
        ) : (
          <MinuteRing minute={match.minute} isLive={false} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
        <Link
          href={`/teams/${match.awayCode.toLowerCase()}`}
          className="flex min-w-0 items-center justify-end gap-2.5 transition-colors hover:text-gold"
        >
          <span className="truncate text-sm font-bold text-white md:text-base">
            {match.away}
          </span>
          <span className="text-2xl drop-shadow-sm">{match.awayFlag}</span>
        </Link>
      </div>

      <HighlightButton href={match.highlightUrl} />
    </div>
  );
}

export default function LiveMatchesPanel({ matches }: { matches: LiveMatchView[] }) {
  const liveCount = matches.filter((match) => match.status === "live").length;

  return (
    <section id="matches" className="animate-fade-up">
      <DashboardCard
        variant={liveCount > 0 ? "live" : "featured"}
        title="משחקים חיים"
        badge={
          liveCount > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full bg-live/20 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-red-300">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
              {liveCount} LIVE
            </span>
          ) : (
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">
              FIFA
            </span>
          )
        }
      >
        {matches.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">אין משחקים כרגע</p>
        ) : (
          matches.map((match) => <MatchRow key={match.id} match={match} />)
        )}
      </DashboardCard>
    </section>
  );
}
