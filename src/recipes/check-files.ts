// Checks import files on the server (import design, screens B and I): the
// limits, the schema, and how each compares with the household's saved
// recipe of the same id. Saves nothing.
import { diffRecipes, sameRecipe } from "./diff";
import { MAX_FILE_BYTES, isJsonName, type ImportFile, type ReviewItem } from "./review";
import { parseRecipe, type Problem } from "./validate";
import type { Recipe } from "@/types/recipe";

/** The recipe ids in these files, as far as they can be read (to look up what's saved). */
export function slugsIn(files: ImportFile[]): string[] {
  const slugs = new Set<string>();
  for (const file of files) {
    try {
      const id = (JSON.parse(file.text ?? "") as { id?: unknown })?.id;
      if (typeof id === "string") slugs.add(id);
    } catch {
      // Not JSON: checkFile explains.
    }
  }
  return [...slugs];
}

/** One file's place in the review. `saved` is the household's recipes by id. */
export function checkFile(file: ImportFile, saved: Map<string, Recipe>): ReviewItem {
  const whole = (problem: Problem, name: string | null = null): ReviewItem => ({
    status: "problems",
    file: file.name,
    name,
    problems: [problem],
    whole: true,
  });

  if (!isJsonName(file.name)) {
    return whole({
      title: `${file.name} isn't a recipe file`,
      detail: "Only .json recipe files can be imported. Got a .zip export? Unzip it first.",
      path: "",
    });
  }
  const bytes = file.text === null ? file.size : new TextEncoder().encode(file.text).length;
  if (bytes > MAX_FILE_BYTES || file.text === null) {
    return whole({
      title: `${file.name} is too big`,
      detail: `Recipe files are at most 256 KB; this one is ${Math.ceil(bytes / 1024)} KB. Check it's a recipe file from Claude.`,
      path: "",
    });
  }

  const result = parseRecipe(file.text);
  if (!result.ok) {
    const name = nameIn(file.text);
    return "fileProblem" in result
      ? whole(result.fileProblem, name)
      : { status: "problems", file: file.name, name, problems: result.problems, whole: false };
  }

  const recipe = result.recipe;
  const before = saved.get(recipe.id);
  if (!before) return { status: "new", file: file.name, recipe };
  if (sameRecipe(before, recipe)) return { status: "unchanged", file: file.name, name: recipe.name };
  return { status: "update", file: file.name, recipe, changes: diffRecipes(before, recipe) };
}

function nameIn(text: string): string | null {
  try {
    const name = (JSON.parse(text) as { name?: unknown })?.name;
    return typeof name === "string" && name.trim() ? name : null;
  } catch {
    return null;
  }
}
