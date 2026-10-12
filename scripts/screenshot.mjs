// Screenshots an HTML file in chunks, for checking designs without a desktop browser.
//   node scripts/screenshot.mjs designs/foundations.html /tmp/shots/f [width=390] [dark]
// Writes <prefix>-0.png, <prefix>-1.png, ... each up to 1100px tall.
// Needs a browser once per machine: pnpm exec playwright install --only-shell chromium
import { resolve } from "node:path";
import { chromium } from "playwright";

const [file, prefix, width = "390", theme] = process.argv.slice(2);
if (!file || !prefix) throw new Error("usage: screenshot.mjs <file> <out-prefix> [width] [dark]");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 1000 } });
await page.goto(`file://${resolve(file)}`);
if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
const height = await page.evaluate(() => document.documentElement.scrollHeight);
let i = 0;
for (let y = 0; y < height; y += 1100) {
  const clip = { x: 0, y, width: Number(width), height: Math.min(1100, height - y) };
  await page.screenshot({ path: `${prefix}-${i++}.png`, fullPage: true, clip });
}
console.log(`${i} screenshots, ${height}px tall`);
await browser.close();
