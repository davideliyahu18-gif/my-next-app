import Link from "next/link";
import { notFound } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import { getMatchById } from "@/lib/fifa-api";
import { resolveFifaCentreUrl } from "@/lib/fifa-match-centre";
import type { FifaGoal } from "@/lib/fifa-api";

export const dynamic = "force-dynamic";

function matchStatusLabel(status: string): string {
  if (status === "IN_PLAY" || status === "PAUSE") return "חי";
  if (status === "FINISHED") return "הסתיים";
  return "קרוב";
}

function GoalRow({ goal }: { goal: FifaGoal }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-3 last:border-0">
      <span className="text-sm font-semibold text-white">
        {goal.teamName ? `${goal.teamName} · ` : ""}
        {goal.scorer}
      </span>
      <span className="shrink-0 rounded-full bg-[#d4af37]/15 px-2.5 py-0.5 text-xs font-bold text-[#d4af37]">
        {goal.minute}
      </span>
    </li>
  );
}

export default async function HighlightPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  let match;
  try {
    match = await getMatchById(matchId, true);
  } catch {
    notFound();
  }

  const kickoff = match.utcDate.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });

  const fifaUrl = resolveFifaCentreUrl({
    id: match.id,
    kickoffAt: match.utcDate.toISOString(),
    idCompetition: match.idCompetition,
    idSeason: match.idSeason,
    idStage: match.idStage,
    status:
      match.status === "IN_PLAY" || match.status === "PAUSE"
        ? "live"
        : match.status === "FINISHED"
          ? "finished"
          : "upcoming",
  });

  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} - ${match.awayScore}`
      : "VS";

  return (
    <div dir="rtl" className="min-h-screen bg-black font-sans text-white">
      <header className="border-b border-white/[0.06] bg-black/90 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link
            href="/#matches"
            className="text-sm font-medium text-zinc-400 transition-colors hover:text-[#d4af37]"
          >
            ← חזרה למשחקים
          </Link>
          <span className="text-xs font-semibold text-zinc-500">{matchStatusLabel(match.status)}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold text-zinc-500">{match.group || match.stage || match.competition}</p>
          <div className="mt-6 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">{match.homeFlag}</span>
              <span className="text-lg font-bold">{match.homeTeam}</span>
            </div>
            <div className="text-4xl font-black text-[#d4af37]">{score}</div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">{match.awayFlag}</span>
              <span className="text-lg font-bold">{match.awayTeam}</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-500">{kickoff}</p>
        </div>

        <DashboardCard title="תקציר המשחק">
          {match.goals.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              {match.status === "SCHEDULED"
                ? "המשחק עדיין לא התחיל."
                : match.status === "IN_PLAY" || match.status === "PAUSE"
                  ? "עדיין אין שערים — התקציר מתעדכן בזמן אמת."
                  : "אין שערים רשומים למשחק זה."}
            </p>
          ) : (
            <ul className="px-5 py-2">
              {match.goals.map((goal) => (
                <GoalRow key={goal.eventId || `${goal.minute}-${goal.scorer}`} goal={goal} />
              ))}
            </ul>
          )}
        </DashboardCard>

        <div className="mt-6 rounded-2xl border border-[#d4af37]/20 bg-[#d4af37]/5 p-6 text-center">
          <p className="text-sm text-zinc-300">וידאו תקציר רשמי מ-FIFA.com</p>
          <a
            href={fifaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#d4af37] px-6 py-3 text-sm font-black text-black transition-transform hover:scale-[1.02]"
          >
            ▶ צפו בווידאו ב-FIFA.com
          </a>
          <p className="mt-3 text-xs text-zinc-500">מקור רשמי · לא YouTube</p>
        </div>
      </main>
    </div>
  );
}
