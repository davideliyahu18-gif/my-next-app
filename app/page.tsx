import CompactScorers from "@/components/CompactScorers";
import FeedNews from "@/components/FeedNews";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import LeadingStats from "@/components/LeadingStats";
import LiveMatches from "@/components/LiveMatches";
import NextMatch from "@/components/NextMatch";
import SocialBar from "@/components/SocialBar";
import Standings from "@/components/Standings";
import { getLiveMatches } from "@/lib/api";

export const revalidate = 30;

export default async function Home() {
  const matches = await getLiveMatches();
  const nextMatch =
    matches.find((match) => match.status === "upcoming") ?? matches[0] ?? null;

  return (
    <div dir="rtl" className="min-h-screen bg-black font-sans text-white">
      <Header />
      <Hero />

      <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="space-y-6 lg:col-span-3">
            <NextMatch match={nextMatch} />
            <div id="scorers">
              <CompactScorers />
            </div>
            <SocialBar />
          </aside>

          <div className="lg:col-span-6">
            <LiveMatches />
          </div>

          <aside className="space-y-6 lg:col-span-3">
            <Standings compact />
            <FeedNews />
          </aside>
        </div>

        <LeadingStats />
      </main>

      <Footer />
    </div>
  );
}
