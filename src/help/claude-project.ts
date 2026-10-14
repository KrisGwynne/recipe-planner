import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * What the Claude.ai project needs, read from the repo's own copies
 * (claude-project/, schema/, examples/) so the help page (PP-179) always
 * hands out the versions Import checks against. Each path is written out
 * in full so the build bundles exactly these files with the help routes.
 */
export const PROJECT_FILES = [
  {
    name: "recipe.schema.json",
    source: "schema/recipe.schema.json",
    about: "The rules every recipe file follows",
    read: () => readFile(path.join(process.cwd(), "schema", "recipe.schema.json"), "utf8"),
  },
  {
    name: "lemony-tuna-tomato-caper-pasta.json",
    source: "examples/lemony-tuna-tomato-caper-pasta.json",
    about: "Example: printed nutrition",
    read: () => readFile(path.join(process.cwd(), "examples", "lemony-tuna-tomato-caper-pasta.json"), "utf8"),
  },
  {
    name: "char-siu-tofoo-noodles.json",
    source: "examples/char-siu-tofoo-noodles.json",
    about: "Example: estimated nutrition",
    read: () => readFile(path.join(process.cwd(), "examples", "char-siu-tofoo-noodles.json"), "utf8"),
  },
] as const;

/** The text to paste into the project's instructions. */
export function readInstructions(): Promise<string> {
  return readFile(path.join(process.cwd(), "claude-project", "instructions.md"), "utf8");
}

/** One of PROJECT_FILES by its download name, or null for any other name. */
export async function readProjectFile(name: string): Promise<string | null> {
  const file = PROJECT_FILES.find((f) => f.name === name);
  return file ? file.read() : null;
}
