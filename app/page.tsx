import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import LiveFeed from "@/components/LiveFeed";
import LiveMatches from "@/components/LiveMatches";
import Standings from "@/components/Standings";
import TopScorers from "@/components/TopScorers";

export default function Home() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#050505] font-sans text-white">
      <Header />
      <Hero />

      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-8 md:py-24">
        <div className="grid gap-16 xl:grid-cols-[1fr_360px] xl:gap-12">
          <div className="min-w-0 space-y-20">
            <LiveMatches />
            <LiveFeed />
            <TopScorers />
          </div>

          <Standings />
        </div>
      </div>

      <Footer />
    </div>
  );
}
