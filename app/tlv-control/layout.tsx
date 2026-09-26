import type { Metadata, Viewport } from "next";
import "./tlv-control.css";

const TITLE_HE = "מרכז בקרה אווירי – נתב\"ג";
const SUBTITLE_HE = "מטוסים חיים, המראות ונחיתות, מזג אוויר והתרעות סביב נתב\"ג";

export const metadata: Metadata = {
  title: TITLE_HE,
  description: SUBTITLE_HE,
  manifest: "/manifest-tlv-control.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: TITLE_HE,
  },
  icons: {
    icon: [
      { url: "/icon-iran-airspace-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-iran-airspace-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-iran-airspace-apple-touch.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050b14",
};

export default function TlvControlLayout({ children }: { children: React.ReactNode }) {
  return <div className="tlv-control-root">{children}</div>;
}
