"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRecipesBySlugs, requireHousehold, saveRecipe } from "@/data";
import { checkFile, slugsIn } from "@/recipes/check-files";
import { MAX_FILES, type ImportFile, type ReviewItem } from "@/recipes/review";
import type { Problem } from "@/recipes/validate";

// Files come from the browser, so their shape is checked; Next limits the
// request size (next.config.ts) and each file's size is checked again.
const importFiles = z
  .array(z.object({ name: z.string().min(1).max(255), size: z.number().int().min(0), text: z.string().nullable() }))
  .max(MAX_FILES);

/** Checks files and compares them with the household's recipes (screen B). Saves nothing. */
export async function reviewImportAction(files: ImportFile[]): Promise<ReviewItem[]> {
  const { ctx } = await requireHousehold();
  const checked = importFiles.parse(files);
  const saved = await getRecipesBySlugs(ctx, slugsIn(checked));
  const bySlug = new Map(saved.map((r) => [r.slug, r.data]));
  return checked.map((file) => checkFile(file, bySlug));
}

export type ImportResult =
  | { file: string; saved: true; id: string; name: string; created: boolean }
  | { file: string; saved: false; name: string | null; problems: Problem[] };

/**
 * Saves the files the review said were ready. Each is checked again here:
 * the browser's copy of the review isn't trusted.
 */
export async function importRecipesAction(files: ImportFile[]): Promise<ImportResult[]> {
  const { ctx } = await requireHousehold();
  const checked = importFiles.parse(files);
  const results: ImportResult[] = [];
  for (const file of checked) {
    const item = checkFile(file, new Map());
    if (item.status === "problems") {
      results.push({ file: file.name, saved: false, name: item.name, problems: item.problems });
      continue;
    }
    if (item.status !== "new") continue; // With nothing saved to compare, a valid file is always "new".
    const { id, created } = await saveRecipe(ctx, item.recipe);
    results.push({ file: file.name, saved: true, id, name: item.recipe.name, created });
  }
  revalidatePath("/recipes");
  return results;
}
