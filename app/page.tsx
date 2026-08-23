import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import LeaguesDashboard from "@/components/LeaguesDashboard";
import { getLeaguesDashboard } from "@/lib/api";

export const revalidate = 60;

export default async function Home() {
  const dashboard = await getLeaguesDashboard();

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      <Hero />

      <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <LeaguesDashboard initial={dashboard} />
      </main>

      <Footer />
    </div>
  );
}
