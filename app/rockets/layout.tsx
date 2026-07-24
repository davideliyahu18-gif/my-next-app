import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מכ״ם שיגורים · מפה לבנה",
  description:
    "מפת שיגורים לבנה עם פיד טלגרם מעודכן מ־@newsil5 ו־@shigurimisrael.",
};

export default function RocketsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
