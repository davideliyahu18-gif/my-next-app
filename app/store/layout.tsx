import type { Metadata } from "next";
import { Archivo, Rubik } from "next/font/google";
import { STORE_BRAND } from "@/lib/store/products";
import "./store.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <div className={`${archivo.variable} ${rubik.variable}`}>{children}</div>
  );
}
