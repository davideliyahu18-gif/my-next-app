import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dash - דאש · שיגורים",
  description:
    "דאש לייב: מפת מעקב, שיגורים לעבר ישראל, ופיד טלגרם מעודכן.",
};

export default function RocketsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
