import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מלונות וטיסות · חיפוש חופשה",
  description:
    "חיפוש מלונות לפי עיר על גבי מפה, ומעקב טיסות נתב״ג — הכל במקום אחד. נתונים חופשיים מ-OpenStreetMap ורשות שדות התעופה.",
};

export default function HotelsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
