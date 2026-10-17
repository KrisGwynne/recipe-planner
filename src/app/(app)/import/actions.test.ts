import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { createTestDb } from "@/db/test-db";
import { getRecipeBySlug, listRecipes, reserveImports, saveRecipe } from "@/data";
import { twoHouseholds, type TwoHouseholds } from "@/data/test-fixtures";
import type { Recipe } from "@/types/recipe";

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  user: { id: "kris", name: "Kris", email: "kris@example.com" },
}));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/auth", () => ({ requireUser: async () => mocks.user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { importRecipesAction, reviewImportAction } = await import("./actions");
const importRecipes = async (files: Parameters<typeof importRecipesAction>[0]) => (await importRecipesAction(files)).results;

const text = (slug: string) => readFileSync(new URL(`../../../../examples/${slug}.json`, import.meta.url), "utf8");
const tunaText = text("lemony-tuna-tomato-caper-pasta");
const tofooText = text("char-siu-tofoo-noodles");
const tuna = (): Recipe => JSON.parse(tunaText);
const file = (name: string, content: string) => ({ name, size: content.length, text: content });
const as = (id: string) => {
  mocks.user = { id, name: id, email: `${id}@example.com` };
};

let h: TwoHouseholds;

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
  as("kris");
});

describe("reviewImportAction", () => {
  it("sorts files without saving anything", async () => {
    const changed = tuna();
    changed.serves = 2;
    await saveRecipe(h.a, tuna());
    const items = await reviewImportAction([
      file("tofoo.json", tofooText),
      file("tuna.json", JSON.stringify(changed)),
      file("same.json", tunaText),
      file("broken.json", "{"),
    ]);
    expect(items.map((i) => i.status)).toEqual(["new", "update", "unchanged", "problems"]);
    expect(await listRecipes(h.a)).toHaveLength(1);
  });

  it("compares only with the user's household", async () => {
    const changed = tuna();
    changed.serves = 2;
    await saveRecipe(h.b, tuna());
    const [item] = await reviewImportAction([file("tuna.json", JSON.stringify(changed))]);
    expect(item.status).toBe("new");
  });

  it("refuses more than 50 files", async () => {
    await expect(reviewImportAction(Array.from({ length: 51 }, (_, i) => file(`${i}.json`, "{}")))).rejects.toThrow();
  });
});

describe("importRecipesAction", () => {
  it("both examples import cleanly", async () => {
    const results = await importRecipes([file("tuna.json", tunaText), file("tofoo.json", tofooText)]);
    expect(results).toEqual([
      expect.objectContaining({ file: "tuna.json", saved: true, created: true, name: tuna().name }),
      expect.objectContaining({ file: "tofoo.json", saved: true, created: true }),
    ]);
    expect((await listRecipes(h.a)).map((r) => r.slug).sort()).toEqual([
      "char-siu-tofoo-noodles",
      "lemony-tuna-tomato-caper-pasta",
    ]);
  });

  it("re-importing a changed file updates the same recipe", async () => {
    const { id } = await saveRecipe(h.a, tuna());
    const changed = tuna();
    changed.times.cook_mins = 25;
    const [result] = await importRecipes([file("tuna.json", JSON.stringify(changed))]);
    // The same row, so household data keyed by its id (favourite, notes: PP-169) stays with it.
    expect(result).toMatchObject({ saved: true, created: false, id });
    expect(await getRecipeBySlug(h.a, tuna().id)).toMatchObject({ id, totalMins: 30, data: changed });
  });

  it("two households can each import the same file", async () => {
    await importRecipes([file("tuna.json", tunaText)]);
    as("alex");
    const [result] = await importRecipes([file("tuna.json", tunaText)]);
    expect(result).toMatchObject({ saved: true, created: true });
    expect(await listRecipes(h.a)).toHaveLength(1);
    expect(await listRecipes(h.b)).toHaveLength(1);
  });

  it("checks files again, saving nothing from a bad one", async () => {
    const results = await importRecipes([file("broken.json", '{"id": "x"}'), file("tofoo.json", tofooText)]);
    expect(results[0]).toMatchObject({ saved: false, file: "broken.json" });
    expect(results[1]).toMatchObject({ saved: true });
    expect(await listRecipes(h.a)).toHaveLength(1);
  });

  it("members can import", async () => {
    as("sam");
    const [result] = await importRecipes([file("tuna.json", tunaText)]);
    expect(result).toMatchObject({ saved: true });
    expect(await listRecipes(h.a)).toHaveLength(1);
  });
});

describe("the hourly limit (PP-163)", () => {
  it("counts the recipes saved, not the files sent", async () => {
    await importRecipes([file("broken.json", '{"id": "x"}'), file("tuna.json", tunaText)]);
    // 1 counted: another 199 fit, 200 don't.
    expect(await reserveImports(h.a, 199)).toEqual({ ok: true });
    expect(await reserveImports(h.a, 1)).toMatchObject({ ok: false });
  });

  it("over the limit, says when to try again and saves nothing", async () => {
    await reserveImports(h.a, 199);
    const response = await importRecipesAction([file("tuna.json", tunaText), file("tofoo.json", tofooText)]);
    expect(response).toEqual({ results: [], limited: { retryMinutes: 60 } });
    expect(await listRecipes(h.a)).toEqual([]);
  });

  it("is per person: someone else in the household can still import", async () => {
    await reserveImports(h.a, 200);
    as("sam");
    expect(await importRecipes([file("tuna.json", tunaText)])).toMatchObject([{ saved: true }]);
  });
});
