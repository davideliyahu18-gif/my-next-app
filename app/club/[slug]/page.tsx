import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LiveMatchCenter from "@/components/LiveMatchCenter";
import TeamCrest from "@/components/TeamCrest";
import { fetchClubProfile, fetchMatchCenter } from "@/lib/football/match-center";
import type { LeagueMatchView } from "@/lib/football/leagues-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function MiniMatchRow({ match }: { match: LeagueMatchView }) {
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} - ${match.awayScore}`
      : match.timeLabel;

  return (
    <Link
      href={`/match/${match.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3 transition-colors hover:border-gold/30"
    >
      <div className="min-w-0 text-sm font-bold text-white">
        <p className="truncate">{match.home}</p>
        <p className="truncate text-zinc-300">{match.away}</p>
      </div>
      <div className="shrink-0 text-center">
        <p className="text-sm font-black text-gold">{score}</p>
        <p className="text-[10px] text-zinc-500">
          {match.status === "live" ? "LIVE" : match.dateLabel}
        </p>
      </div>
    </Link>
  );
}

export default async function ClubPage({ params }: PageProps) {
  const { slug } = await params;
  const club = await fetchClubProfile(slug);
  if (!club) notFound();

  const liveCenter = club.liveMatch
    ? await fetchMatchCenter(club.liveMatch.id, true)
    : null;

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-400 transition-colors hover:text-gold"
        >
          ← חזרה לדף הבית
        </Link>

        <section className="mb-8 flex items-center gap-4 rounded-3xl border border-gold/20 bg-gradient-to-l from-card via-card to-gold/10 p-6">
          <TeamCrest src={club.logo} name={club.name} size={64} />
          <div>
            <p className="text-xs font-bold text-gold">
              {club.leagueFlag} {club.leagueName}
            </p>
            <h1 className="mt-1 text-3xl font-black text-white">{club.name}</h1>
          </div>
        </section>

        {liveCenter ? (
          <div className="mb-8">
            <p className="mb-3 text-sm font-bold text-red-300">משחק חי עכשיו</p>
            <LiveMatchCenter initial={liveCenter} />
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-white/[0.07] bg-card p-5">
            <h2 className="text-sm font-extrabold text-white">משחקים קרובים</h2>
            <div className="mt-4 space-y-2">
              {club.upcoming.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">
                  אין משחקים קרובים
                </p>
              ) : (
                club.upcoming.map((match) => (
                  <MiniMatchRow key={match.id} match={match} />
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-card p-5">
            <h2 className="text-sm font-extrabold text-white">משחקים אחרונים</h2>
            <div className="mt-4 space-y-2">
              {club.recent.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">
                  אין תוצאות עדיין
                </p>
              ) : (
                club.recent.map((match) => (
                  <MiniMatchRow key={match.id} match={match} />
                ))
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
