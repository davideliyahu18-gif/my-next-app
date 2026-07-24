import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מכ״ם שיגורים · איראן → כווית",
  description:
    "מעקב שיגורים איראן→כווית עם התראות WhatsApp ומיקום — ויזואליזציה/OSINT, לא טלמטריה צבאית חיה.",
};

export default function RocketsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
