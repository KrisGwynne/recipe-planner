// The import review (designs/src/import.html, screens B and I): types, limits
// and the parts that run in the browser. Checking a file against the schema
// is server-side (check-files.ts), so Ajv stays out of the browser.
import type { Recipe } from "@/types/recipe";
import type { Change } from "./diff";
import type { Problem } from "./validate";

export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 256 * 1024;
/**
 * The most recipes one person can import in an hour (PP-163): enough to move
 * a large library over in a few goes, not enough to fill the database.
 */
export const IMPORTS_PER_HOUR = 200;
/** Files go to the server in requests of at most this much (Vercel allows 4.5 MB a request). */
export const MAX_REQUEST_BYTES = 3 * 1024 * 1024;

/** A picked file or the paste box. `text` is null when it wasn't read (not .json, or too big). */
export type ImportFile = { name: string; size: number; text: string | null };

export type ReviewItem =
  | { status: "new"; file: string; recipe: Recipe }
  | { status: "update"; file: string; recipe: Recipe; changes: Change[] }
  | { status: "unchanged"; file: string; name: string }
  /** `name` is the recipe's name if the file has one. `whole` is a single whole-file problem (screen I). */
  | { status: "problems"; file: string; name: string | null; problems: Problem[]; whole: boolean };

export const PASTED = "Pasted recipe";

/** Screen I's "Too many files", or null. */
export function tooManyFiles(count: number): Problem | null {
  if (count <= MAX_FILES) return null;
  return {
    title: "Too many files",
    detail: `You picked ${count} files; the most at once is ${MAX_FILES}. Pick fewer and import the rest after.`,
    path: "",
  };
}

/** Screen I's "Too many imports for now". `saved` is how many of this import were saved before the limit. */
export function tooManyImports(retryMinutes: number, saved = 0): Problem {
  const wait = retryMinutes <= 1 ? "about a minute" : `about ${retryMinutes} minutes`;
  return {
    title: "Too many imports for now",
    detail:
      saved > 0
        ? `You've imported a lot in the last hour. ${saved === 1 ? "1 recipe was" : `${saved} recipes were`} saved; try the rest again in ${wait}.`
        : `You've imported a lot in the last hour. Try again in ${wait}. Nothing from this batch was saved.`,
    path: "",
  };
}

/** Whether a file is worth reading: .json and not too big. Otherwise its name and size say why. */
export function shouldRead(name: string, size: number): boolean {
  return isJsonName(name) && size <= MAX_FILE_BYTES;
}

export function isJsonName(name: string): boolean {
  return name === PASTED || name.toLowerCase().endsWith(".json");
}

/** Groups files into requests under MAX_REQUEST_BYTES, keeping their order. */
export function inRequests<T extends { text: string | null }>(files: T[]): T[][] {
  const requests: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const file of files) {
    const size = file.text?.length ?? 0;
    if (current.length > 0 && bytes + size > MAX_REQUEST_BYTES) {
      requests.push(current);
      current = [];
      bytes = 0;
    }
    current.push(file);
    bytes += size;
  }
  if (current.length > 0) requests.push(current);
  return requests;
}

/**
 * Two files in one batch with the same recipe id: the later one becomes a
 * problem rather than silently replacing the first.
 */
export function markDuplicates(items: ReviewItem[]): ReviewItem[] {
  const seen = new Map<string, string>();
  return items.map((item) => {
    const slug = item.status === "new" || item.status === "update" ? item.recipe.id : null;
    if (!slug) return item;
    const first = seen.get(slug);
    if (!first) {
      seen.set(slug, item.file);
      return item;
    }
    if (item.status !== "new" && item.status !== "update") return item;
    return {
      status: "problems",
      file: item.file,
      name: item.recipe.name,
      whole: false,
      problems: [
        {
          title: `Same recipe id as ${first}`,
          detail: `Both files have the id "${slug}", so only one can be imported. If they're different recipes, ask Claude for a different id for one of them.`,
          path: "id",
        },
      ],
    };
  });
}

/** The "Copy problems for Claude" message: every problem, ready to paste into the Claude project. */
export function problemsForClaude(fileName: string, problems: Problem[]): string {
  const lines = problems.map((p, i) => `${i + 1}. ${p.title}${p.path ? ` (${p.path})` : ""}: ${p.detail}`);
  return [
    `The recipe file "${fileName}" didn't import into Recipe planner. Please fix these problems, keeping to the schema, and give me the whole file again:`,
    "",
    ...lines,
  ].join("\n");
}
