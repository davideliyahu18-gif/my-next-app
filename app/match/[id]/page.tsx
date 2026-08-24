import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LiveMatchCenter from "@/components/LiveMatchCenter";
import { fetchMatchCenter } from "@/lib/football/match-center";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MatchPage({ params }: PageProps) {
  const { id } = await params;
  const match = await fetchMatchCenter(id, true);
  if (!match) notFound();

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans text-foreground">
      <Header />
      <main className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
        <Link
          href="/today"
          className="mb-6 inline-block text-sm text-zinc-400 transition-colors hover:text-gold"
        >
          ← חזרה למשחקי היום
        </Link>
        <LiveMatchCenter initial={match} />
      </main>
      <Footer />
    </div>
  );
}
