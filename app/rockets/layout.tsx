import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "חמ״ל לייב · תפריט",
  description:
    "חמ״ל לייב: תפריט אזורים, זמן למרחב מוגן, מפה חיה ופיד שיגורים.",
};

export default function RocketsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
