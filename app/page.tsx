import FifaDashboard from "@/components/FifaDashboard";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import SemiFinalLineupsPanel from "@/components/SemiFinalLineupsPanel";
import { getFifaDashboard, getSemiFinalLineups } from "@/lib/api";

export const revalidate = 30;

export default async function Home() {
  const [dashboard, lineups] = await Promise.all([
    getFifaDashboard(),
    getSemiFinalLineups(),
  ]);

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      <Hero />

      <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <FifaDashboard initial={dashboard} />
        <SemiFinalLineupsPanel matches={lineups} />
      </main>

      <Footer />
    </div>
  );
}
