import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { recipes } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import type { Recipe } from "@/types/recipe";
import { deleteRecipe, getRecipe, getRecipeBySlug, getRecipesBySlugs, listRecipes, saveRecipe } from "./recipes";
import { twoHouseholds, type TwoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));

const example = (slug: string): Recipe =>
  JSON.parse(readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8"));
const tunaPasta = example("lemony-tuna-tomato-caper-pasta");
const tofooNoodles = example("char-siu-tofoo-noodles");

let h: TwoHouseholds;

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
});

describe("saveRecipe", () => {
  it("stores the file untouched, with every column derived from it", async () => {
    const { id, created } = await saveRecipe(h.a, tunaPasta);
    expect(created).toBe(true);
    const row = await getRecipe(h.a, id);
    expect(row?.data).toEqual(tunaPasta);
    expect(row).toMatchObject({
      householdId: h.a.householdId,
      slug: "lemony-tuna-tomato-caper-pasta",
      proteinType: "fish",
      proteinItems: ["tuna"],
      hasVeggieOption: true,
      totalMins: 35,
      carbs: ["pasta"],
      saltG: 1.5,
      sourceKind: "magazine",
      sourceTitle: "BBC Good Food",
      createdBy: "kris",
      updatedBy: "kris",
    });
  });

  it("updates the recipe with the same slug, re-deriving its columns and keeping its id and creator", async () => {
    const first = await saveRecipe(h.a, tunaPasta);
    const changed: Recipe = {
      ...tunaPasta,
      name: "Tuna pasta",
      proteins: [{ category: "meat", item: "chicken" }],
      variations: [],
    };
    const second = await saveRecipe(h.aMember, changed);
    expect(second).toEqual({ id: first.id, created: false });
    expect(await mocks.db.select().from(recipes)).toHaveLength(1);
    expect(await getRecipe(h.a, first.id)).toMatchObject({
      name: "Tuna pasta",
      proteinType: "meat",
      proteinItems: ["chicken"],
      hasVeggieOption: false,
      data: changed,
      createdBy: "kris",
      updatedBy: "sam",
    });
  });

  it("lets two households have the same slug", async () => {
    const a = await saveRecipe(h.a, tunaPasta);
    const b = await saveRecipe(h.b, tunaPasta);
    expect(a.id).not.toBe(b.id);
    expect(b.created).toBe(true);
  });

  it("makes one row from two saves at once", async () => {
    await Promise.all([saveRecipe(h.a, tunaPasta), saveRecipe(h.a, tunaPasta)]);
    expect(await mocks.db.select().from(recipes)).toHaveLength(1);
  });
});

describe("reading", () => {
  it("finds a recipe by slug", async () => {
    const { id } = await saveRecipe(h.a, tofooNoodles);
    expect((await getRecipeBySlug(h.a, "char-siu-tofoo-noodles"))?.id).toBe(id);
    expect(await getRecipeBySlug(h.a, "no-such-recipe")).toBeNull();
  });

  it("is null for an id that isn't a uuid", async () => {
    expect(await getRecipe(h.a, "not-a-uuid")).toBeNull();
  });

  it("finds several by slug, with their files", async () => {
    const { id } = await saveRecipe(h.a, tunaPasta);
    expect(await getRecipesBySlugs(h.a, [tunaPasta.id, "no-such-recipe"])).toEqual([
      { id, slug: tunaPasta.id, data: tunaPasta },
    ]);
    expect(await getRecipesBySlugs(h.a, [])).toEqual([]);
  });

  it("lists the household's recipes A to Z, ignoring case", async () => {
    await saveRecipe(h.a, tunaPasta);
    await saveRecipe(h.a, tofooNoodles);
    await saveRecipe(h.a, { ...tofooNoodles, id: "apple-crumble", name: "apple crumble" });
    expect((await listRecipes(h.a)).map((r) => r.name)).toEqual([
      "apple crumble",
      expect.stringMatching(/^Char siu/),
      "Lemony tuna, tomato & caper one-pot pasta",
    ]);
  });
});

describe("deleteRecipe", () => {
  it("deletes once", async () => {
    const { id } = await saveRecipe(h.a, tunaPasta);
    expect(await deleteRecipe(h.aMember, id)).toBe(true);
    expect(await deleteRecipe(h.a, id)).toBe(false);
    expect(await getRecipe(h.a, id)).toBeNull();
  });

  it("is false for an id that isn't a uuid", async () => {
    expect(await deleteRecipe(h.a, "not-a-uuid")).toBe(false);
  });
});

describe("isolation", () => {
  let bRecipe: string;

  beforeEach(async () => {
    ({ id: bRecipe } = await saveRecipe(h.b, tunaPasta));
  });

  it("household A can't read B's recipe by id or slug", async () => {
    expect(await getRecipe(h.a, bRecipe)).toBeNull();
    expect(await getRecipeBySlug(h.a, tunaPasta.id)).toBeNull();
    expect(await getRecipesBySlugs(h.a, [tunaPasta.id])).toEqual([]);
  });

  it("household A's list doesn't include B's recipes", async () => {
    expect(await listRecipes(h.a)).toEqual([]);
    expect(await listRecipes(h.b)).toHaveLength(1);
  });

  it("household A saving the same slug makes its own recipe and leaves B's alone", async () => {
    const changed: Recipe = { ...tunaPasta, name: "Changed by A" };
    const { id, created } = await saveRecipe(h.a, changed);
    expect(created).toBe(true);
    expect(id).not.toBe(bRecipe);
    expect(await getRecipe(h.b, bRecipe)).toMatchObject({ name: tunaPasta.name, data: tunaPasta, updatedBy: "alex" });
  });

  it("household A can't delete B's recipe by id", async () => {
    expect(await deleteRecipe(h.a, bRecipe)).toBe(false);
    expect(await getRecipe(h.b, bRecipe)).not.toBeNull();
  });
});
