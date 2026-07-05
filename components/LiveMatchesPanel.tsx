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
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
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
      className={`flex items-center gap-3 border-b border-white/[0.04] px-5 py-4 last:border-0 ${
        isLive ? "bg-red-500/[0.03]" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-xl">{match.homeFlag}</span>
        <span className="truncate text-sm font-semibold text-white">{match.home}</span>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1 px-2">
        <span className="text-lg font-black tabular-nums text-white">{score}</span>
        <MinuteRing minute={match.minute} isLive={isLive} />
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="truncate text-sm font-semibold text-white">{match.away}</span>
        <span className="text-xl">{match.awayFlag}</span>
      </div>

      <HighlightButton href={match.highlightUrl} />
    </div>
  );
}

export default function LiveMatchesPanel({ matches }: { matches: LiveMatchView[] }) {
  const liveCount = matches.filter((match) => match.status === "live").length;

  return (
    <section id="matches">
      <DashboardCard
        title="משחקים חיים"
        badge={
          liveCount > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              LIVE
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500">מ-FIFA API</span>
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
