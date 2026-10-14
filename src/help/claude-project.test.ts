import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/(app)/import/help/[file]/route";
import { PROJECT_FILES, readInstructions, readProjectFile } from "./claude-project";

const repo = (path: string) => readFileSync(path, "utf8");
const get = (file: string) => GET(new Request(`http://localhost/import/help/${file}`), { params: Promise.resolve({ file }) });

describe("the Claude project's files (PP-179)", () => {
  it("are the repo's own copies, byte for byte", async () => {
    expect(await readInstructions()).toBe(repo("claude-project/instructions.md"));
    expect(await readProjectFile("recipe.schema.json")).toBe(repo("schema/recipe.schema.json"));
    for (const file of PROJECT_FILES) expect(await readProjectFile(file.name)).toBe(repo(file.source));
  });

  it("are the schema and every example that the setup steps name", () => {
    expect(PROJECT_FILES.map((f) => f.source)).toEqual([
      "schema/recipe.schema.json",
      "examples/lemony-tuna-tomato-caper-pasta.json",
      "examples/char-siu-tofoo-noodles.json",
    ]);
  });

  it("finds nothing by any other name", async () => {
    for (const name of ["instructions.md", "../.env", "..%2Fpackage.json", "package.json", ""]) {
      expect(await readProjectFile(name)).toBeNull();
    }
  });
});

describe("GET /import/help/<file>", () => {
  it("downloads a file as JSON, named as it should be saved", async () => {
    const response = await get("char-siu-tofoo-noodles.json");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="char-siu-tofoo-noodles.json"');
    expect(await response.text()).toBe(repo("examples/char-siu-tofoo-noodles.json"));
  });

  it("is a 404 for anything else", async () => {
    expect((await get("../../.env")).status).toBe(404);
    expect((await get("next.config.ts")).status).toBe(404);
  });
});
