import type { Metadata } from "next";
import { Rubik, Space_Grotesk } from "next/font/google";
import { STORE_BRAND } from "@/lib/store/products";
import "./store.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${STORE_BRAND.name} · חנות גיימינג`,
  description: STORE_BRAND.description,
};

export default function StoreLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${spaceGrotesk.variable} ${rubik.variable}`}>
      {children}
    </div>
  );
}
