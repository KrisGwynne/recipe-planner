import type { Recipe } from "@/types/recipe";

/** A recipe as a file: the stored JSON, indented. Both downloads (one recipe, and all of them) use it. */
export function recipeFileText(recipe: Recipe): string {
  return `${JSON.stringify(recipe, null, 2)}\n`;
}
