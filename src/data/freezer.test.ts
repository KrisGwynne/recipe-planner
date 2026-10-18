import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { createTestDb } from "@/db/test-db";
import type { PlanInput } from "@/plans/plan";
import type { Recipe } from "@/types/recipe";
import {
  addFromFreezer,
  addToFreezer,
  availableFromFreezer,
  freezeLeftovers,
  listFreezer,
  removeFromFreezer,
  setFreezerCount,
  unfreezeLeftovers,
} from "./freezer";
import {
  addEntry,
  addLeftovers,
  availableLeftovers,
  copyPlan,
  createPlan,
  deletePlan,
  getPlan,
  moveEntry,
  removeEntry,
  setEntryPortions,
  updatePlan,
} from "./plans";
import { saveRecipe } from "./recipes";
import { twoHouseholds, type TwoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));

const tunaPasta: Recipe = JSON.parse(
  readFileSync(new URL("../../examples/lemony-tuna-tomato-caper-pasta.json", import.meta.url), "utf8"),
);
// A big batch: serves 8, so 2 people at 1 each leave 6.
const chilli: Recipe = { ...tunaPasta, id: "big-chilli", name: "Smoky beef & bean chilli", serves: 8 };

const thisWeek: PlanInput = { name: "This week", startDate: "2026-10-12", days: 7, people: 2 };
// Mon 12 Oct is day 0.
const MON = "2026-10-12";

let h: TwoHouseholds;
let recipe: string;
let plan: string;
let cook: string;

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
  recipe = (await saveRecipe(h.a, chilli)).id;
  plan = await createPlan(h.a, thisWeek);
  // Tue dinner.
  cook = (await addEntry(h.a, plan, { dayIndex: 1, slot: "dinner", recipeId: recipe }))!;
});

async function entry(id: string, planId = plan) {
  return (await getPlan(h.a, planId))!.entries.find((e) => e.id === id)!;
}

describe("freezing leftovers (F)", () => {
  it("freezes up to what's left, on the cook's day, and counts it against the cook", async () => {
    expect(await freezeLeftovers(h.a, cook, 6.5)).toBeNull();
    const item = await freezeLeftovers(h.a, cook, 4);
    expect(item).not.toBeNull();
    expect((await entry(cook)).frozen).toEqual({ itemId: item, frozenOn: "2026-10-13", servings: 4 });
    // 6 left, 4 frozen: 2 for leftovers.
    expect((await availableLeftovers(h.a, plan, { dayIndex: 3, slot: "lunch" }))[0].left).toBe(2);
    expect(await addLeftovers(h.a, plan, { dayIndex: 3, slot: "lunch", cookId: cook, portionsPerPerson: 1.5 })).toBeNull();
    // The cook can't go up into what's frozen.
    expect(await setEntryPortions(h.a, cook, 2.5)).toBe(false);
    expect(await setEntryPortions(h.a, cook, 2)).toBe(true);
  });

  it("changes or undoes freezing, but not below what's planned from it", async () => {
    const item = (await freezeLeftovers(h.a, cook, 4))!;
    expect(await freezeLeftovers(h.a, cook, 2)).toBe(item);
    expect((await entry(cook)).frozen?.servings).toBe(2);
    await addFromFreezer(h.a, plan, { dayIndex: 4, slot: "dinner", itemId: item });
    expect(await freezeLeftovers(h.a, cook, 1)).toBeNull();
    expect(await unfreezeLeftovers(h.a, cook)).toBe(false);
    await removeEntry(h.a, (await getPlan(h.a, plan))!.entries.find((e) => e.fromFreezer)!.id);
    expect(await unfreezeLeftovers(h.a, cook)).toBe(true);
    expect((await entry(cook)).frozen).toBeNull();
  });

  it("only freezes a cook: not leftovers or a meal from the freezer", async () => {
    const meal = (await addLeftovers(h.a, plan, { dayIndex: 2, slot: "lunch", cookId: cook }))!;
    expect(await freezeLeftovers(h.a, meal, 1)).toBeNull();
  });
});

describe("the freezer list (H)", () => {
  it("lists what's in, oldest first, with what's going in and where it came from", async () => {
    await freezeLeftovers(h.a, cook, 4);
    const soup = (await addToFreezer(h.a, { recipeId: recipe, servings: 3, frozenOn: "2026-10-04" }, MON))!;
    const items = await listFreezer(h.a, MON);
    expect(items.map((i) => [i.frozenOn, i.goingIn, i.inFreezer])).toEqual([
      ["2026-10-04", false, 3],
      ["2026-10-13", true, 4],
    ]);
    expect(items[0]).toMatchObject({ id: soup, from: null, planned: [], recipe: { name: chilli.name, serves: 8 } });
    expect(items[0].recipe.storage).toEqual(chilli.storage);
    expect(items[1].from).toEqual({ planId: plan, planName: "This week", date: "2026-10-13", slot: "dinner" });
    // The next day it's in.
    expect((await listFreezer(h.a, "2026-10-14"))[1].goingIn).toBe(false);
  });

  it("takes planned servings out once the meal's day has passed", async () => {
    const item = (await addToFreezer(h.a, { recipeId: recipe, servings: 4, frozenOn: "2026-10-01" }, MON))!;
    const meal = (await addFromFreezer(h.a, plan, { dayIndex: 2, slot: "dinner", itemId: item }))!;
    const [before] = await listFreezer(h.a, MON);
    expect(before).toMatchObject({ inFreezer: 4, planned: [{ entryId: meal, date: "2026-10-14", slot: "dinner", servings: 2, planName: "This week" }] });
    const [after] = await listFreezer(h.a, "2026-10-15");
    expect(after).toMatchObject({ inFreezer: 2, planned: [] });
    // Eaten entirely: off the list.
    await addFromFreezer(h.a, plan, { dayIndex: 3, slot: "dinner", itemId: item });
    expect(await listFreezer(h.a, "2026-10-16")).toEqual([]);
  });

  it("adds by hand, frozen today or earlier", async () => {
    expect(await addToFreezer(h.a, { recipeId: recipe, servings: 3, frozenOn: "2026-10-13" }, MON)).toBeNull();
    expect(await addToFreezer(h.a, { recipeId: recipe, servings: 3, frozenOn: MON }, MON)).not.toBeNull();
    await expect(addToFreezer(h.a, { recipeId: recipe, servings: 0, frozenOn: MON }, MON)).rejects.toThrow();
    await expect(addToFreezer(h.a, { recipeId: recipe, servings: 1.25, frozenOn: MON }, MON)).rejects.toThrow();
  });

  it("corrects the count, not below what's planned, and takes it all out", async () => {
    const item = (await addToFreezer(h.a, { recipeId: recipe, servings: 4, frozenOn: "2026-10-01" }, MON))!;
    expect(await setFreezerCount(h.a, item, 5, MON)).toBe(true);
    expect((await listFreezer(h.a, MON))[0].inFreezer).toBe(5);
    const meal = (await addFromFreezer(h.a, plan, { dayIndex: 2, slot: "dinner", itemId: item, portionsPerPerson: 1.5 }))!;
    expect(await setFreezerCount(h.a, item, 2.5, MON)).toBe(false);
    expect(await setFreezerCount(h.a, item, 3, MON)).toBe(true);
    // After the meal: 3 − 3 eaten leaves nothing.
    expect(await listFreezer(h.a, "2026-10-15")).toEqual([]);

    expect(await removeFromFreezer(h.a, item)).toBe(true);
    // The meal planned from it becomes an ordinary cook.
    expect((await entry(meal)).fromFreezer).toBeNull();
  });
});

describe("meals from the freezer (D, E)", () => {
  it("plans from what's in by the meal, up to what's free", async () => {
    const item = (await freezeLeftovers(h.a, cook, 3))!;
    // Not before Tue dinner, when it goes in.
    expect(await addFromFreezer(h.a, plan, { dayIndex: 1, slot: "lunch", itemId: item })).toBeNull();
    expect(await addFromFreezer(h.a, plan, { dayIndex: 1, slot: "dinner", itemId: item })).toBeNull();
    expect((await availableFromFreezer(h.a, plan, { dayIndex: 1, slot: "lunch" })).map((a) => a.itemId)).toEqual([]);
    expect((await availableFromFreezer(h.a, plan, { dayIndex: 1, slot: "snack" })).map((a) => [a.itemId, a.free])).toEqual([[item, 3]]);

    const meal = (await addFromFreezer(h.a, plan, { dayIndex: 4, slot: "dinner", itemId: item }))!;
    expect(await entry(meal)).toMatchObject({
      portionsPerPerson: 1,
      recipe: { id: recipe },
      fromFreezer: { itemId: item, frozenOn: "2026-10-13", free: 1 },
      leftoversOf: null,
    });
    // 1 free: ½ each, then nothing.
    const second = (await addFromFreezer(h.a, plan, { dayIndex: 5, slot: "dinner", itemId: item }))!;
    expect((await entry(second)).portionsPerPerson).toBe(0.5);
    expect(await addFromFreezer(h.a, plan, { dayIndex: 6, slot: "dinner", itemId: item })).toBeNull();
    expect(await availableFromFreezer(h.a, plan, { dayIndex: 6, slot: "dinner" })).toEqual([]);
    // Capped at what's free; and it can't feed leftovers of its own.
    expect(await setEntryPortions(h.a, second, 1)).toBe(false);
    expect(await addLeftovers(h.a, plan, { dayIndex: 6, slot: "lunch", cookId: meal, portionsPerPerson: 0.5 })).toBeNull();
  });

  it("keeps a meal from the freezer after it goes in when moved, and moves frozen leftovers with their cook", async () => {
    const item = (await freezeLeftovers(h.a, cook, 3))!;
    const meal = (await addFromFreezer(h.a, plan, { dayIndex: 4, slot: "dinner", itemId: item }))!;
    expect(await moveEntry(h.a, meal, { dayIndex: 1, slot: "lunch" })).toBe(false);
    expect(await moveEntry(h.a, meal, { dayIndex: 2, slot: "lunch" })).toBe(true);
    // The cook can't move after a meal eating its frozen leftovers.
    expect(await moveEntry(h.a, cook, { dayIndex: 3, slot: "dinner" })).toBe(false);
    expect(await moveEntry(h.a, cook, { dayIndex: 0, slot: "dinner" })).toBe(true);
    expect((await entry(cook)).frozen?.frozenOn).toBe(MON);
    // A new start date moves it too.
    await updatePlan(h.a, plan, { ...thisWeek, startDate: "2026-10-19" });
    expect((await entry(cook)).frozen?.frozenOn).toBe("2026-10-19");
  });

  it("isn't copied to a new plan", async () => {
    const item = (await freezeLeftovers(h.a, cook, 3))!;
    await addFromFreezer(h.a, plan, { dayIndex: 4, slot: "dinner", itemId: item });
    const copy = (await copyPlan(h.a, plan, { ...thisWeek, startDate: "2026-10-19" }))!;
    expect((await getPlan(h.a, copy))!.entries.map((e) => [e.dayIndex, e.frozen, e.fromFreezer])).toEqual([[1, null, null]]);
  });
});

describe("removing a cook with frozen leftovers (L)", () => {
  it("takes them off the list if they haven't gone in yet", async () => {
    await freezeLeftovers(h.a, cook, 4);
    expect(await removeEntry(h.a, cook, MON)).toBe(true);
    expect(await listFreezer(h.a, MON)).toEqual([]);
  });

  it("keeps them once they're in", async () => {
    await freezeLeftovers(h.a, cook, 4);
    expect(await removeEntry(h.a, cook, "2026-10-14")).toBe(true);
    expect(await listFreezer(h.a, "2026-10-14")).toMatchObject([{ inFreezer: 4, from: null }]);
  });

  it("does the same when the plan is deleted or shortened", async () => {
    await freezeLeftovers(h.a, cook, 4);
    await updatePlan(h.a, plan, { ...thisWeek, days: 1 }, MON);
    expect(await listFreezer(h.a, MON)).toEqual([]);

    const again = (await addEntry(h.a, plan, { dayIndex: 0, slot: "dinner", recipeId: recipe }))!;
    await freezeLeftovers(h.a, again, 2);
    expect(await deletePlan(h.a, plan, MON)).toBe(true);
    // Mon 12 isn't after today (Mon 12): it's in, so it stays.
    expect(await listFreezer(h.a, MON)).toMatchObject([{ inFreezer: 2, from: null }]);
  });
});

describe("household isolation", () => {
  let bItem: string;
  let bPlan: string;
  let bCook: string;

  beforeEach(async () => {
    const bRecipe = (await saveRecipe(h.b, chilli)).id;
    bPlan = await createPlan(h.b, thisWeek);
    bCook = (await addEntry(h.b, bPlan, { dayIndex: 0, slot: "dinner", recipeId: bRecipe }))!;
    bItem = (await addToFreezer(h.b, { recipeId: bRecipe, servings: 4, frozenOn: "2026-10-01" }, MON))!;
  });

  it("doesn't list, change or take out B's freezer", async () => {
    expect(await listFreezer(h.a, MON)).toEqual([]);
    expect(await listFreezer(h.aMember, MON)).toEqual([]);
    expect(await setFreezerCount(h.a, bItem, 1, MON)).toBe(false);
    expect(await removeFromFreezer(h.a, bItem)).toBe(false);
    expect(await freezeLeftovers(h.a, bCook, 1)).toBeNull();
    expect(await unfreezeLeftovers(h.a, bCook)).toBe(false);
    expect(await listFreezer(h.b, MON)).toMatchObject([{ id: bItem, inFreezer: 4 }]);
  });

  it("doesn't plan from B's freezer, or put A's recipe in it", async () => {
    expect(await addFromFreezer(h.a, plan, { dayIndex: 3, slot: "dinner", itemId: bItem })).toBeNull();
    expect(await addFromFreezer(h.a, bPlan, { dayIndex: 3, slot: "dinner", itemId: bItem })).toBeNull();
    expect(await availableFromFreezer(h.a, plan, { dayIndex: 3, slot: "dinner" })).toEqual([]);
    expect(await availableFromFreezer(h.a, bPlan, { dayIndex: 3, slot: "dinner" })).toEqual([]);
    expect(await addToFreezer(h.b, { recipeId: recipe, servings: 1, frozenOn: MON }, MON)).toBeNull();
    // A's items stay out of B's list.
    await addToFreezer(h.a, { recipeId: recipe, servings: 1, frozenOn: MON }, MON);
    expect((await listFreezer(h.b, MON)).map((i) => i.id)).toEqual([bItem]);
  });
});
