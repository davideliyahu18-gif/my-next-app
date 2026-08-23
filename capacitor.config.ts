import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell loads the live Vercel site in fullscreen WebView.
 * Updates ship on the web — no App Store resubmit for content changes.
 */
const config: CapacitorConfig = {
  appId: "il.co.realtimefootball.app",
  appName: "כדורגל בזמן אמת",
  webDir: "mobile-shell",
  server: {
    url:
      process.env.CAPACITOR_SERVER_URL ||
      "https://my-next-app-5jte.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
    scheme: "RealtimeFootball",
    backgroundColor: "#050505",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#050505",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#050505",
    },
  },
};

export default config;
