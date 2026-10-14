import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { recipeCooks, recipeHouseholdData } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { MAX_NOTES } from "@/recipes/household";
import type { Recipe } from "@/types/recipe";
import {
  getRecipeHousehold,
  markCooked,
  setFavourite,
  setNotes,
  setRating,
  unmarkCooked,
} from "./recipe-household";
import { deleteRecipe, listRecipes, saveRecipe } from "./recipes";
import { twoHouseholds, type TwoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));

const example = (slug: string): Recipe =>
  JSON.parse(readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8"));
const tunaPasta = example("lemony-tuna-tomato-caper-pasta");
const tofooNoodles = example("char-siu-tofoo-noodles");

let h: TwoHouseholds;
let tuna: string;
let tofoo: string;

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
  tuna = (await saveRecipe(h.a, tunaPasta)).id;
  tofoo = (await saveRecipe(h.a, tofooNoodles)).id;
});

const nothingYet = { favourite: false, rating: null, notes: null, cooked: [] };

describe("getRecipeHousehold", () => {
  it("is empty for a recipe nothing has been set on", async () => {
    expect(await getRecipeHousehold(h.a, tuna)).toEqual(nothingYet);
  });

  it("finds nothing for an id that isn't a recipe", async () => {
    expect(await getRecipeHousehold(h.a, "not-a-uuid")).toBeNull();
    expect(await getRecipeHousehold(h.a, crypto.randomUUID())).toBeNull();
  });
});

describe("favourite, rating and notes", () => {
  it("sets each without touching the others, shared by the household", async () => {
    expect(await setFavourite(h.a, tuna, true)).toBe(true);
    expect(await setRating(h.aMember, tuna, 4)).toBe(true);
    expect(await getRecipeHousehold(h.aMember, tuna)).toMatchObject({ favourite: true, rating: 4, notes: null });

    await setFavourite(h.a, tuna, false);
    await setRating(h.a, tuna, null);
    expect(await getRecipeHousehold(h.a, tuna)).toEqual(nothingYet);
  });

  it("refuses a rating outside 1 to 5 or not whole", async () => {
    await expect(setRating(h.a, tuna, 0)).rejects.toThrow();
    await expect(setRating(h.a, tuna, 6)).rejects.toThrow();
    await expect(setRating(h.a, tuna, 3.5)).rejects.toThrow();
  });

  it("saves notes trimmed, with who edited them last", async () => {
    await setNotes(h.a, tuna, "  Double the capers.  ");
    await setNotes(h.aMember, tuna, "Double the capers. Orzo works too.");
    const notes = (await getRecipeHousehold(h.a, tuna))?.notes;
    expect(notes).toMatchObject({ text: "Double the capers. Orzo works too.", editedBy: "Sam" });
    expect(notes?.editedAt).toBeInstanceOf(Date);
  });

  it("deletes notes saved empty, and refuses notes that are too long", async () => {
    await setNotes(h.a, tuna, "Double the capers.");
    await setNotes(h.a, tuna, "   ");
    expect((await getRecipeHousehold(h.a, tuna))?.notes).toBeNull();
    await expect(setNotes(h.a, tuna, "x".repeat(MAX_NOTES + 1))).rejects.toThrow();
    expect(await setNotes(h.a, tuna, `${"x".repeat(MAX_NOTES)}  `)).toBe(true);
  });
});

describe("cooked", () => {
  it("keeps one entry a day, most recent first, and undoes a day", async () => {
    await markCooked(h.a, tuna, "2026-09-14");
    await markCooked(h.a, tuna, "2026-10-02");
    expect(await markCooked(h.aMember, tuna, "2026-10-02")).toBe(true);
    expect((await getRecipeHousehold(h.a, tuna))?.cooked).toEqual(["2026-10-02", "2026-09-14"]);

    expect(await unmarkCooked(h.a, tuna, "2026-10-02")).toBe(true);
    expect(await unmarkCooked(h.a, tuna, "2026-10-02")).toBe(false);
    expect((await getRecipeHousehold(h.a, tuna))?.cooked).toEqual(["2026-09-14"]);
  });

  it("refuses a day that isn't a date", async () => {
    await expect(markCooked(h.a, tuna, "yesterday")).rejects.toThrow();
  });
});

describe("listRecipes", () => {
  it("returns each recipe's favourite, rating and last cooked day", async () => {
    await setFavourite(h.a, tuna, true);
    await setRating(h.a, tuna, 5);
    await markCooked(h.a, tuna, "2026-09-14");
    await markCooked(h.a, tuna, "2026-10-02");
    const list = await listRecipes(h.a);
    expect(list.find((r) => r.id === tuna)).toMatchObject({ favourite: true, rating: 5, lastCooked: "2026-10-02" });
    expect(list.find((r) => r.id === tofoo)).toMatchObject({ favourite: false, rating: null, lastCooked: null });
  });
});

describe("the recipe file", () => {
  it("re-importing a recipe keeps its household data", async () => {
    await setFavourite(h.a, tuna, true);
    await setRating(h.a, tuna, 4);
    await setNotes(h.a, tuna, "Double the capers.");
    await markCooked(h.a, tuna, "2026-10-02");
    const reimported = await saveRecipe(h.a, { ...tunaPasta, name: "Tuna pasta, new version" });
    expect(reimported).toEqual({ id: tuna, created: false });
    expect(await getRecipeHousehold(h.a, tuna)).toMatchObject({
      favourite: true,
      rating: 4,
      notes: { text: "Double the capers." },
      cooked: ["2026-10-02"],
    });
  });

  it("deleting a recipe deletes its household data", async () => {
    await setRating(h.a, tuna, 4);
    await markCooked(h.a, tuna, "2026-10-02");
    await deleteRecipe(h.a, tuna);
    expect(await mocks.db.select().from(recipeHouseholdData)).toEqual([]);
    expect(await mocks.db.select().from(recipeCooks)).toEqual([]);
  });
});

describe("household isolation", () => {
  let bRecipe: string;

  beforeEach(async () => {
    bRecipe = (await saveRecipe(h.b, tunaPasta)).id;
    await setFavourite(h.b, bRecipe, true);
    await setRating(h.b, bRecipe, 2);
    await setNotes(h.b, bRecipe, "B's notes");
    await markCooked(h.b, bRecipe, "2026-10-01");
  });

  const bUnchanged = async () =>
    expect(await getRecipeHousehold(h.b, bRecipe)).toMatchObject({
      favourite: true,
      rating: 2,
      notes: { text: "B's notes", editedBy: "Alex" },
      cooked: ["2026-10-01"],
    });

  it("doesn't read B's data", async () => {
    expect(await getRecipeHousehold(h.a, bRecipe)).toBeNull();
    expect(await getRecipeHousehold(h.aMember, bRecipe)).toBeNull();
    expect((await listRecipes(h.a)).map((r) => r.id).sort()).toEqual([tofoo, tuna].sort());
  });

  it("doesn't favourite, rate, note or mark cooked B's recipe", async () => {
    expect(await setFavourite(h.a, bRecipe, false)).toBe(false);
    expect(await setRating(h.a, bRecipe, 5)).toBe(false);
    expect(await setRating(h.a, bRecipe, null)).toBe(false);
    expect(await setNotes(h.a, bRecipe, "Mine now")).toBe(false);
    expect(await setNotes(h.a, bRecipe, "")).toBe(false);
    expect(await markCooked(h.a, bRecipe, "2026-10-02")).toBe(false);
    expect(await unmarkCooked(h.a, bRecipe, "2026-10-01")).toBe(false);
    await bUnchanged();
  });

  it("A's data for the same recipe file is A's own", async () => {
    // Both households imported the tuna pasta; A's row is a different recipe.
    expect(await getRecipeHousehold(h.a, tuna)).toEqual(nothingYet);
    await setRating(h.a, tuna, 5);
    await bUnchanged();
  });
});
