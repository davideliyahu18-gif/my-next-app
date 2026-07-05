import FeedNews from "@/components/FeedNews";
import FifaDashboard from "@/components/FifaDashboard";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import { getFifaDashboard } from "@/lib/api";

export const revalidate = 30;

export default async function Home() {
  const dashboard = await getFifaDashboard();

  return (
    <div dir="rtl" className="min-h-screen bg-black font-sans text-white">
      <Header />
      <Hero />

      <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
        <FifaDashboard initial={dashboard} />
      </main>

      <Footer />
    </div>
  );
}
