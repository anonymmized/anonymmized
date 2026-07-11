#!/usr/bin/env node
// Generates a dark, amber-themed GitHub contribution calendar as a self-hosted SVG.
// Data source: the public https://github.com/users/<user>/contributions page (no auth).
// Output: assets/calendar-dark.svg  (dark empty cells + amber scale, matches the profile theme)

import { writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.GH_USER || "anonymmized";

// --- theme ---------------------------------------------------------------
const BG = "#0d1117";
const BORDER = "#d2992233"; // faint amber
const TEXT = "#8b949e";
const LEVELS = ["#161b22", "#3d2f10", "#7a5c17", "#b8881f", "#f2b829"]; // 0..4 (empty -> bright amber)

// --- geometry ------------------------------------------------------------
const CELL = 11, GAP = 3, STEP = CELL + GAP;
const PAD_L = 30, PAD_T = 44, PAD_B = 12, PAD_R = 34;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");

async function main() {
  const url = `https://github.com/users/${USER}/contributions`;
  const html = await (await fetch(url, { headers: { "User-Agent": "calendar-gen" } })).text();

  // pull each day: data-date="YYYY-MM-DD" ... data-level="N"
  const days = [];
  const re = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
  let m;
  while ((m = re.exec(html)) !== null) days.push({ date: m[1], level: +m[2] });
  if (!days.length) throw new Error("no contribution cells found");

  const totalMatch = html.match(/([\d,]+)\s+contribution/i);
  const total = totalMatch ? totalMatch[1] : String(days.length);

  // place into columns (weeks). GitHub weeks start on Sunday.
  const start = new Date(days[0].date + "T00:00:00Z");
  const startDow = start.getUTCDay();
  let maxCol = 0;
  const cells = days.map(({ date, level }) => {
    const d = new Date(date + "T00:00:00Z");
    const off = Math.round((d - start) / 86400000);
    const col = Math.floor((off + startDow) / 7);
    const row = d.getUTCDay();
    if (col > maxCol) maxCol = col;
    return { col, row, level, date };
  });
  const cols = maxCol + 1;

  const W = PAD_L + cols * STEP + PAD_R;
  const H = PAD_T + 7 * STEP + PAD_B;

  // month labels: first appearance of each month across columns
  const monthLabels = [];
  let lastMonth = -1;
  for (const c of cells) {
    if (c.row !== 0) continue; // top row of each week
    const mo = +c.date.slice(5, 7) - 1;
    if (mo !== lastMonth) {
      monthLabels.push({ col: c.col, mo });
      lastMonth = mo;
    }
  }

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'JetBrains Mono',ui-monospace,monospace" role="img" aria-label="${esc(total)} contributions in the last year">`);
  parts.push(`<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" rx="10" fill="${BG}" stroke="${BORDER}"/>`);

  // header row: prompt (left) + total (right)
  parts.push(`<text x="${PAD_L}" y="20" font-size="11" fill="${TEXT}">$ contributions --last-year</text>`);
  parts.push(`<text x="${W - PAD_R}" y="20" font-size="11" fill="#d29922" text-anchor="end" font-weight="700">${esc(total)} total</text>`);

  // month labels
  for (const { col, mo } of monthLabels) {
    const x = PAD_L + col * STEP;
    if (x < W - 20) parts.push(`<text x="${x}" y="${PAD_T - 8}" font-size="10" fill="${TEXT}">${MONTHS[mo]}</text>`);
  }
  // weekday labels
  const dayLbl = { 1: "Mon", 3: "Wed", 5: "Fri" };
  for (const r of [1, 3, 5]) {
    const y = PAD_T + r * STEP + CELL - 2;
    parts.push(`<text x="4" y="${y}" font-size="9" fill="${TEXT}">${dayLbl[r]}</text>`);
  }
  // cells
  for (const { col, row, level } of cells) {
    const x = PAD_L + col * STEP;
    const y = PAD_T + row * STEP;
    parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${LEVELS[level]}"/>`);
  }
  // legend
  const lgY = H - PAD_B + 1;
  let lx = W - PAD_R - (5 * (CELL + 2)) - 62;
  parts.push(`<text x="${lx}" y="${lgY}" font-size="9" fill="${TEXT}">Less</text>`);
  lx += 30;
  for (let i = 0; i < 5; i++) {
    parts.push(`<rect x="${lx + i * (CELL - 1)}" y="${lgY - 9}" width="${CELL - 2}" height="${CELL - 2}" rx="2" fill="${LEVELS[i]}"/>`);
  }
  parts.push(`<text x="${lx + 5 * (CELL - 1) + 4}" y="${lgY}" font-size="9" fill="${TEXT}">More</text>`);

  parts.push(`</svg>`);

  mkdirSync("assets", { recursive: true });
  writeFileSync("assets/calendar-dark.svg", parts.join("\n"));
  console.log(`calendar written: ${cols} weeks, ${cells.length} days, total ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
