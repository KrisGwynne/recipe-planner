import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Recipe } from "@/types/recipe";
import { checkFile, slugsIn } from "./check-files";
import { inRequests, markDuplicates, MAX_FILE_BYTES, PASTED, shouldRead, tooManyFiles, tooManyImports, type ImportFile } from "./review";

const text = (slug: string) => readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8");
const tunaText = text("lemony-tuna-tomato-caper-pasta");
const tuna = (): Recipe => JSON.parse(tunaText);
const file = (name: string, content: string | null): ImportFile => ({ name, size: content?.length ?? 0, text: content });

describe("checkFile", () => {
  it("a new recipe", () => {
    expect(checkFile(file("tuna.json", tunaText), new Map())).toEqual({ status: "new", file: "tuna.json", recipe: tuna() });
  });

  it("an update, with what changes", () => {
    const changed = tuna();
    changed.serves = 2;
    const item = checkFile(file("tuna.json", JSON.stringify(changed)), new Map([[changed.id, tuna()]]));
    expect(item).toMatchObject({ status: "update", recipe: changed, changes: [{ field: "serves" }] });
  });

  it("unchanged, whatever the key order", () => {
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(tuna()).reverse()));
    expect(checkFile(file("tuna.json", reordered), new Map([[tuna().id, tuna()]]))).toEqual({
      status: "unchanged",
      file: "tuna.json",
      name: tuna().name,
    });
  });

  it("problems, named by the recipe's name", () => {
    const broken = tuna() as unknown as Record<string, unknown>;
    broken.difficulty = "tricky";
    expect(checkFile(file("tuna.json", JSON.stringify(broken)), new Map())).toMatchObject({
      status: "problems",
      name: tuna().name,
      whole: false,
      problems: [{ title: 'Unknown difficulty "tricky"' }],
    });
  });

  it("broken JSON is one whole-file problem", () => {
    expect(checkFile(file("tuna.json", "{"), new Map())).toMatchObject({
      status: "problems",
      name: null,
      whole: true,
      problems: [{ title: "This file isn't valid JSON" }],
    });
  });

  it("a file that isn't .json (screen I)", () => {
    expect(checkFile(file("IMG_2041.jpg", null), new Map())).toMatchObject({
      status: "problems",
      whole: true,
      problems: [
        {
          title: "IMG_2041.jpg isn't a recipe file",
          detail: "Only .json recipe files can be imported. Got a .zip export? Unzip it first.",
        },
      ],
    });
  });

  it("a file over 256 KB, read or not", () => {
    const big = file("big.json", `{"name": "${"x".repeat(MAX_FILE_BYTES)}"}`);
    expect(checkFile(big, new Map())).toMatchObject({ whole: true, problems: [{ title: "big.json is too big" }] });
    expect(checkFile({ name: "big.json", size: 300_000, text: null }, new Map())).toMatchObject({
      problems: [{ title: "big.json is too big", detail: expect.stringContaining("this one is 293 KB") }],
    });
  });

  it("pasted text counts as JSON", () => {
    expect(checkFile(file(PASTED, tunaText), new Map())).toMatchObject({ status: "new", file: PASTED });
  });
});

describe("slugsIn", () => {
  it("reads the ids it can", () => {
    expect(slugsIn([file("a.json", tunaText), file("b.json", "{"), file("c.jpg", null), file("d.json", tunaText)])).toEqual([
      tuna().id,
    ]);
  });
});

describe("limits", () => {
  it("50 files at most", () => {
    expect(tooManyFiles(50)).toBeNull();
    expect(tooManyFiles(63)).toEqual({
      title: "Too many files",
      detail: "You picked 63 files; the most at once is 50. Pick fewer and import the rest after.",
      path: "",
    });
  });

  it("reads only .json files up to 256 KB", () => {
    expect(shouldRead("tuna.json", 5000)).toBe(true);
    expect(shouldRead("TUNA.JSON", 5000)).toBe(true);
    expect(shouldRead("photo.jpg", 5000)).toBe(false);
    expect(shouldRead("tuna.json", MAX_FILE_BYTES + 1)).toBe(false);
  });

  it("groups files into requests under 3 MB, in order", () => {
    const mb = "x".repeat(1024 * 1024);
    const files = [file("a", mb), file("b", mb), file("c", mb), file("d", null), file("e", mb)];
    expect(inRequests(files).map((r) => r.map((f) => f.name))).toEqual([["a", "b", "c", "d"], ["e"]]);
    expect(inRequests([])).toEqual([]);
  });
});

describe("markDuplicates", () => {
  it("makes the second file with an id a problem", () => {
    const items = markDuplicates([
      { status: "new", file: "one.json", recipe: tuna() },
      { status: "new", file: "two.json", recipe: tuna() },
    ]);
    expect(items[0].status).toBe("new");
    expect(items[1]).toMatchObject({
      status: "problems",
      file: "two.json",
      name: tuna().name,
      problems: [{ title: "Same recipe id as one.json", path: "id" }],
    });
  });
});

describe("tooManyImports (screen I)", () => {
  it("says when to try again, and what was saved", () => {
    expect(tooManyImports(10).detail).toBe(
      "You've imported a lot in the last hour. Try again in about 10 minutes. Nothing from this batch was saved.",
    );
    expect(tooManyImports(1).detail).toContain("Try again in about a minute.");
    expect(tooManyImports(30, 12).detail).toBe("You've imported a lot in the last hour. 12 recipes were saved; try the rest again in about 30 minutes.");
  });
});
