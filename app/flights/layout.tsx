import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "נתב״ג חי · נחיתות והמראות",
  description:
    "לוח טיסות חי לנתב״ג — נחיתות, המראות, עיכובים ומעקב טיסה. מקור רשמי: רשות שדות התעופה.",
};

export default function FlightsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
