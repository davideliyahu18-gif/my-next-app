import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import TodayMatchesBoard from "@/components/TodayMatchesBoard";
import { getTodaysMatches } from "@/lib/api";

export const revalidate = 60;

export default async function TodayMatchesPage() {
  const todays = await getTodaysMatches();

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
        <TodayMatchesBoard initial={todays} />
      </main>
      <Footer />
    </div>
  );
}
