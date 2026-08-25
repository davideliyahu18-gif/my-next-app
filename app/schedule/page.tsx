import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LeagueScheduleTable from "@/components/LeagueScheduleTable";
import { getLeagueSchedule } from "@/lib/api";

export const revalidate = 60;

export default async function SchedulePage() {
  const schedule = await getLeagueSchedule();

  return (
    <div dir="rtl" className="min-h-screen bg-transparent font-sans text-foreground">
      <Header />
      <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-400 transition-colors hover:text-gold"
        >
          ← חזרה לדף הבית
        </Link>
        <LeagueScheduleTable
          leagues={schedule.leagues}
          matchesByLeague={schedule.matchesByLeague}
          championsLeague={schedule.championsLeague}
          fetchedAt={schedule.fetchedAt}
        />
      </main>
      <Footer />
    </div>
  );
}
