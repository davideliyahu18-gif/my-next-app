/**
 * Render league standings as a WhatsApp-ready PNG (SVG → sharp).
 */

import sharp from "sharp";
import type { FootballStandingsTable } from "./standings";

const FONT_REGULAR =
  "file:///usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf";
const FONT_BOLD =
  "file:///usr/share/fonts/truetype/noto/NotoSansHebrew-Bold.ttf";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatGoalDiff(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function truncate(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

export async function renderStandingsPng(
  table: FootballStandingsTable,
  options?: { limit?: number },
): Promise<Buffer> {
  const limit = options?.limit ?? 20;
  const rows = table.rows.slice(0, limit);
  const width = 980;
  const rowH = 44;
  const headerH = 118;
  const colHeaderH = 40;
  const footerH = 52;
  const height = headerH + colHeaderH + rows.length * rowH + footerH;
  const padX = 28;

  // Column x positions (LTR drawing; labels are Hebrew / short)
  const cols = {
    rank: 48,
    team: 78,
    played: 520,
    won: 590,
    drawn: 660,
    lost: 730,
    gd: 820,
    pts: 920,
  };

  const seasonNotStarted = rows.length > 0 && rows.every((r) => r.played === 0);
  const subtitle = [
    table.seasonLabel ? escapeXml(table.seasonLabel) : null,
    seasonNotStarted ? "העונה עדיין לא התחילה" : "דירוג עדכני",
  ]
    .filter(Boolean)
    .join(" · ");

  const rowSvg = rows
    .map((row, index) => {
      const y = headerH + colHeaderH + index * rowH;
      const bg =
        index % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.00)";
      const top3 = row.rank <= 3;
      const rankFill = top3 ? "#4ade80" : "#e2e8f0";
      return `
      <rect x="0" y="${y}" width="${width}" height="${rowH}" fill="${bg}"/>
      <text x="${cols.rank}" y="${y + 29}" text-anchor="middle" class="num" fill="${rankFill}" font-size="18" font-weight="700">${row.rank}</text>
      <text x="${cols.team}" y="${y + 29}" text-anchor="start" class="team" fill="#f8fafc" font-size="20">${escapeXml(truncate(row.teamName, 28))}</text>
      <text x="${cols.played}" y="${y + 29}" text-anchor="middle" class="num" fill="#cbd5e1" font-size="17">${row.played}</text>
      <text x="${cols.won}" y="${y + 29}" text-anchor="middle" class="num" fill="#cbd5e1" font-size="17">${row.won}</text>
      <text x="${cols.drawn}" y="${y + 29}" text-anchor="middle" class="num" fill="#cbd5e1" font-size="17">${row.drawn}</text>
      <text x="${cols.lost}" y="${y + 29}" text-anchor="middle" class="num" fill="#cbd5e1" font-size="17">${row.lost}</text>
      <text x="${cols.gd}" y="${y + 29}" text-anchor="middle" class="num" fill="#94a3b8" font-size="17">${escapeXml(formatGoalDiff(row.goalDiff))}</text>
      <text x="${cols.pts}" y="${y + 29}" text-anchor="middle" class="num" fill="#4ade80" font-size="20" font-weight="700">${row.points}</text>
    `;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: "NotoSansHebrew";
        src: url("${FONT_REGULAR}");
      }
      @font-face {
        font-family: "NotoSansHebrew";
        src: url("${FONT_BOLD}");
        font-weight: 700;
      }
      .title, .team, .label, .footer {
        font-family: "NotoSansHebrew", "Noto Sans Hebrew", Arimo, sans-serif;
      }
      .num {
        font-family: Arimo, "DejaVu Sans", sans-serif;
      }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="#122033"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="6" fill="#22c55e"/>

  <text x="${width - padX}" y="52" text-anchor="end" class="title" fill="#f8fafc" font-size="34" font-weight="700">📊 טבלה — ${escapeXml(table.leagueName)}</text>
  <text x="${width - padX}" y="88" text-anchor="end" class="label" fill="#94a3b8" font-size="18">${subtitle}</text>

  <rect x="0" y="${headerH}" width="${width}" height="${colHeaderH}" fill="rgba(34,197,94,0.12)"/>
  <text x="${cols.rank}" y="${headerH + 27}" text-anchor="middle" class="label" fill="#86efac" font-size="15" font-weight="700">#</text>
  <text x="${cols.team}" y="${headerH + 27}" text-anchor="start" class="label" fill="#86efac" font-size="15" font-weight="700">קבוצה</text>
  <text x="${cols.played}" y="${headerH + 27}" text-anchor="middle" class="label" fill="#86efac" font-size="15" font-weight="700">מש׳</text>
  <text x="${cols.won}" y="${headerH + 27}" text-anchor="middle" class="label" fill="#86efac" font-size="15" font-weight="700">נצ׳</text>
  <text x="${cols.drawn}" y="${headerH + 27}" text-anchor="middle" class="label" fill="#86efac" font-size="15" font-weight="700">ת׳</text>
  <text x="${cols.lost}" y="${headerH + 27}" text-anchor="middle" class="label" fill="#86efac" font-size="15" font-weight="700">הפ׳</text>
  <text x="${cols.gd}" y="${headerH + 27}" text-anchor="middle" class="label" fill="#86efac" font-size="15" font-weight="700">הפרש</text>
  <text x="${cols.pts}" y="${headerH + 27}" text-anchor="middle" class="label" fill="#86efac" font-size="15" font-weight="700">נק׳</text>

  ${rowSvg}

  <text x="${width - padX}" y="${height - 20}" text-anchor="end" class="footer" fill="#64748b" font-size="16">דוד – עדכוני כדורגל ⚽</text>
</svg>`;

  return sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
}
