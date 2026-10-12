/**
 * Draws the app icon (a neon ring, like a trip's category ring) and writes every size the browsers
 * and phones ask for. Run with `pnpm icons` after changing the drawing; the files are committed.
 *
 * - `src/app/icon.svg`: the favicon, on a rounded tile.
 * - `src/app/apple-icon.png`: the iOS home-screen icon, full bleed (iOS rounds the corners).
 * - `public/icons/*.png`: the manifest's icons, rounded ("any") and full bleed ("maskable").
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "@playwright/test";

const BACKGROUND = "#0a0a0a";
/** Ring arcs, as fractions of the circle, in the dark theme's chart colors (cyan first). */
const ARCS = [
  { share: 0.46, color: "#00f1fb" },
  { share: 0.24, color: "#ff2ebd" },
  { share: 0.16, color: "#ffe60c" },
  { share: 0.14, color: "#c562ff" },
];
const RADIUS = 136;
const STROKE = 46;
/** Visible gap between two arcs, on top of the round caps. */
const GAP = 12;

function drawIcon({ rounded }: { rounded: boolean }) {
  const circumference = 2 * Math.PI * RADIUS;
  let start = 0;
  const arcs = ARCS.map(({ share, color }) => {
    // Round caps stick out by half the stroke on each side.
    const length = share * circumference - GAP - STROKE;
    const arc = `<circle r="${RADIUS}" stroke="${color}" stroke-dasharray="${length.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-start - STROKE / 2 - GAP / 2).toFixed(2)}"/>`;
    start += share * circumference;
    return arc;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512"${rounded ? ' rx="112"' : ""} fill="${BACKGROUND}"/>
  <g transform="translate(256 256) rotate(-90)" filter="url(#glow)" fill="none" stroke-width="${STROKE}" stroke-linecap="round">
    ${arcs.join("\n    ")}
  </g>
</svg>
`;
}

const rounded = drawIcon({ rounded: true });
const fullBleed = drawIcon({ rounded: false });

async function render(page: Page, svg: string, size: number, path: string) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await writeFile(path, await page.screenshot({ omitBackground: true }));
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  const page = await browser.newPage();

  await mkdir("public/icons", { recursive: true });
  await writeFile("src/app/icon.svg", rounded);
  await render(page, fullBleed, 180, "src/app/apple-icon.png");
  await render(page, rounded, 192, "public/icons/icon-192.png");
  await render(page, rounded, 512, "public/icons/icon-512.png");
  await render(page, fullBleed, 512, "public/icons/maskable-512.png");
  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
