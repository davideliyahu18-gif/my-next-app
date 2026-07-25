import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dash - דאש · שיגורים",
  description:
    "דאש לייב: מפת מעקב, חמ״ל התרעות איראן, ופיד טלגרם מעודכן.",
};

export default function RocketsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
