// Builds designs/src/*.html into self-contained designs/*.html: compiles the
// Tailwind CSS used by the designs and inlines it in place of the
// <!-- styles --> marker, so each file opens fully styled with no network.
//
//   npm run designs          build once
import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const designs = fileURLToPath(new URL("../designs/", import.meta.url));
const cssOut = join(await mkdtemp(join(tmpdir(), "designs-")), "designs.css");

execFileSync(
  "npx",
  ["tailwindcss", "-i", join(designs, "designs.css"), "-o", cssOut, "--minify"],
  { stdio: ["ignore", "ignore", "inherit"] },
);
const css = await readFile(cssOut, "utf8");

for (const file of await readdir(join(designs, "src"))) {
  if (!file.endsWith(".html")) continue;
  const html = await readFile(join(designs, "src", file), "utf8");
  if (!html.includes("<!-- styles -->")) throw new Error(`${file} has no <!-- styles --> marker`);
  const banner = `<!-- Built from designs/src/${file} by \`npm run designs\`. Edit the source, not this file. -->\n`;
  await writeFile(join(designs, file), banner + html.replace("<!-- styles -->", `<style>${css}</style>`));
  console.log(`Built designs/${file}`);
}
