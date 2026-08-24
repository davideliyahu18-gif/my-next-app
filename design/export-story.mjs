import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "instagram-story.html");
const outPath = path.join(__dirname, "instagram-story.png");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 2,
});

await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: outPath, type: "png" });
await browser.close();

console.log(`Saved: ${outPath}`);
