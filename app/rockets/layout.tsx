import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מכ״ם שיגורים · Rocket Track",
  description:
    "הדמיית מפת מעקב שיגורים מאיראן לישראל — ויזואליזציה, לא טלמטריה צבאית חיה.",
};

export default function RocketsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
