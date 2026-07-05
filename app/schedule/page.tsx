import Link from "next/link";
import Footer from "@/components/Footer";
import FullScheduleTable from "@/components/FullScheduleTable";
import Header from "@/components/Header";
import { getFullSchedule } from "@/lib/api";

export const revalidate = 30;

export default async function SchedulePage() {
  const matches = await getFullSchedule();

  return (
    <div dir="rtl" className="min-h-screen bg-black font-sans text-white">
      <Header />
      <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-400 transition-colors hover:text-[#d4af37]"
        >
          ← חזרה לדף הבית
        </Link>
        <FullScheduleTable
          matches={matches}
          fetchedAt={new Date().toISOString()}
        />
      </main>
      <Footer />
    </div>
  );
}
