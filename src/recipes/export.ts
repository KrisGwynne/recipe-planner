import { strToU8, zipSync } from "fflate";
import type { Recipe } from "@/types/recipe";
import { recipeFileText } from "./file";

// Downloading recipes (PP-164): one schema-valid file per recipe, `<id>.json`,
// exactly the stored file, which Import takes back in.

/** Every recipe as `<id>.json` in a .zip. */
export function recipesZip(recipes: Recipe[]): Uint8Array {
  return zipSync(Object.fromEntries(recipes.map((r) => [`${r.id}.json`, strToU8(recipeFileText(r))])), { level: 6 });
}

/** "The Gwynnes recipes 2026-10-17.zip", without characters file systems refuse. */
export function exportFileName(householdName: string, date: string): string {
  const name = householdName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
  return `${name ? `${name} recipes` : "Recipes"} ${date}.zip`;
}

/** The Content-Disposition for a download, with an ASCII name for older browsers and the full name for the rest. */
export function attachment(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
