import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The setup steps name files to upload to the Claude project; moving one
// shouldn't quietly break them.
describe("claude-project/README.md", () => {
  const readme = readFileSync(new URL("README.md", import.meta.url), "utf8");
  const links = [...readme.matchAll(/\]\((?!https?:)([^)]+)\)/g)].map((m) => m[1]);

  it.each(links)("links to a file that exists: %s", (link) => {
    expect(existsSync(new URL(link, import.meta.url))).toBe(true);
  });

  it("names the schema and every example", () => {
    expect(links).toContain("../schema/recipe.schema.json");
    expect(links).toEqual(expect.arrayContaining(["../examples/lemony-tuna-tomato-caper-pasta.json", "../examples/char-siu-tofoo-noodles.json"]));
  });
});
