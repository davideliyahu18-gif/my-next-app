import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מכ״ם שיגורים · Rocket Track",
  description:
    "מעקב שיגורים לייב ממקורות טלגרם פומביים (@newsil5) — מפה ויזואלית, לא רדאר צבאי.",
};

export default function RocketsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
