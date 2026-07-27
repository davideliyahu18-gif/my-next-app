/**
 * Render team roster as WhatsApp PNG (SVG → sharp).
 */

import sharp from "sharp";
import type { FootballTeamRoster } from "./roster";

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

function truncate(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

export async function renderRosterPng(
  roster: FootballTeamRoster,
): Promise<Buffer> {
  const width = 900;
  const padX = 28;
  const rowH = 36;
  const sectionH = 40;
  const headerH = 110;
  const footerH = 48;

  type Row =
    | { kind: "section"; title: string }
    | { kind: "player"; jersey: string; name: string; age: string };

  const rows: Row[] = [];
  let current = "";
  for (const player of roster.players) {
    if (player.positionHe !== current) {
      current = player.positionHe;
      rows.push({ kind: "section", title: current });
    }
    rows.push({
      kind: "player",
      jersey: player.jersey ? `#${player.jersey}` : "#—",
      name: truncate(player.name, 32),
      age: player.age != null ? String(player.age) : "—",
    });
  }

  let bodyH = 0;
  for (const row of rows) {
    bodyH += row.kind === "section" ? sectionH : rowH;
  }
  const height = headerH + bodyH + footerH;

  let y = headerH;
  const bodySvg = rows
    .map((row, index) => {
      if (row.kind === "section") {
        const block = `
          <rect x="0" y="${y}" width="${width}" height="${sectionH}" fill="rgba(34,197,94,0.12)"/>
          <text x="${width - padX}" y="${y + 27}" text-anchor="end" class="label" fill="#86efac" font-size="18" font-weight="700">${escapeXml(row.title)}</text>
        `;
        y += sectionH;
        return block;
      }
      const bg = index % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent";
      const block = `
        <rect x="0" y="${y}" width="${width}" height="${rowH}" fill="${bg}"/>
        <text x="${padX}" y="${y + 25}" text-anchor="start" class="num" fill="#4ade80" font-size="18" font-weight="700">${escapeXml(row.jersey)}</text>
        <text x="${padX + 70}" y="${y + 25}" text-anchor="start" class="team" fill="#f8fafc" font-size="18">${escapeXml(row.name)}</text>
        <text x="${width - padX}" y="${y + 25}" text-anchor="end" class="num" fill="#94a3b8" font-size="16">${escapeXml(row.age)}</text>
      `;
      y += rowH;
      return block;
    })
    .join("\n");

  const subtitle = [
    roster.seasonLabel ? escapeXml(roster.seasonLabel) : null,
    "⭐ במעקב",
    `${roster.players.length} שחקנים`,
  ]
    .filter(Boolean)
    .join(" · ");

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
      <stop offset="100%" stop-color="#0c1a2e"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="6" fill="#a50044"/>

  <text x="${width - padX}" y="48" text-anchor="end" class="title" fill="#f8fafc" font-size="32" font-weight="700">🧍 סגל — ${escapeXml(roster.teamNameHe)}</text>
  <text x="${width - padX}" y="82" text-anchor="end" class="label" fill="#94a3b8" font-size="17">${subtitle}</text>

  ${bodySvg}

  <text x="${width - padX}" y="${height - 18}" text-anchor="end" class="footer" fill="#64748b" font-size="15">דוד – עדכוני כדורגל ⚽</text>
</svg>`;

  return sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
}
