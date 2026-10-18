import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { mealPlanEntries, mealPlans, recipeCooks, recipeHouseholdData } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import type { PlanInput } from "@/plans/plan";
import type { Recipe } from "@/types/recipe";
import {
  addEntry,
  addLeftovers,
  availableLeftovers,
  copyPlan,
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  moveEntry,
  nextPlan,
  recipePlanUses,
  removeEntry,
  setEntryPortions,
  updatePlan,
} from "./plans";
import { markCooked, setNotes, setRating } from "./recipe-household";
import { deleteRecipe, saveRecipe } from "./recipes";
import { twoHouseholds, type TwoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));

const example = (slug: string): Recipe =>
  JSON.parse(readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8"));
const tunaPasta = example("lemony-tuna-tomato-caper-pasta");
const tofooNoodles = example("char-siu-tofoo-noodles");

const thisWeek: PlanInput = { name: "This week", startDate: "2026-10-12", days: 7, people: 2 };

let h: TwoHouseholds;
let tuna: string;
let tofoo: string;

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
  tuna = (await saveRecipe(h.a, tunaPasta)).id;
  tofoo = (await saveRecipe(h.a, tofooNoodles)).id;
});

describe("createPlan and getPlan", () => {
  it("makes a plan with its details and no entries", async () => {
    const id = await createPlan(h.a, { ...thisWeek, name: "  This week  " });
    expect(await getPlan(h.a, id)).toEqual({ id, ...thisWeek, entries: [] });
    const [row] = await mocks.db.select().from(mealPlans);
    expect(row).toMatchObject({ householdId: h.a.householdId, createdBy: "kris" });
  });

  it("refuses details outside the design's limits", async () => {
    await expect(createPlan(h.a, { ...thisWeek, name: " " })).rejects.toThrow();
    await expect(createPlan(h.a, { ...thisWeek, days: 15 })).rejects.toThrow();
    await expect(createPlan(h.a, { ...thisWeek, people: 0 })).rejects.toThrow();
    await expect(createPlan(h.a, { ...thisWeek, startDate: "2026-02-30" })).rejects.toThrow();
  });

  it("returns entries by day, then meal, then the order they were added, with their recipe", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tofoo });
    await addEntry(h.a, id, { dayIndex: 0, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, id, { dayIndex: 0, slot: "dinner", recipeId: tofoo, portionsPerPerson: 0.5 });
    await addEntry(h.a, id, { dayIndex: 0, slot: "lunch", recipeId: tofoo });
    const plan = await getPlan(h.a, id);
    expect(plan?.entries.map((e) => [e.dayIndex, e.slot, e.recipe.slug, e.portionsPerPerson])).toEqual([
      [0, "lunch", "char-siu-tofoo-noodles", 1],
      [0, "dinner", "lemony-tuna-tomato-caper-pasta", 1],
      [0, "dinner", "char-siu-tofoo-noodles", 0.5],
      [1, "dinner", "char-siu-tofoo-noodles", 1],
    ]);
    expect(plan?.entries[1].recipe).toMatchObject({ name: tunaPasta.name, serves: 4, kcal: 672, nutritionSource: "printed" });
  });

  it("finds nothing for an id that isn't a plan", async () => {
    expect(await getPlan(h.a, "not-a-uuid")).toBeNull();
    expect(await getPlan(h.a, crypto.randomUUID())).toBeNull();
  });
});

describe("listPlans", () => {
  it("lists the household's plans by start date with meals per day, a meal with two recipes counting once", async () => {
    const later = await createPlan(h.a, { ...thisWeek, name: "Half term", startDate: "2026-10-19", days: 3 });
    const now = await createPlan(h.a, thisWeek);
    await addEntry(h.a, now, { dayIndex: 0, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, now, { dayIndex: 0, slot: "dinner", recipeId: tofoo });
    await addEntry(h.a, now, { dayIndex: 2, slot: "lunch", recipeId: tofoo });
    await addEntry(h.a, now, { dayIndex: 2, slot: "dinner", recipeId: tuna });
    expect(await listPlans(h.a)).toEqual([
      {
        id: now,
        ...thisWeek,
        mealsByDay: [1, 0, 2, 0, 0, 0, 0],
        averageKcal: { kcal: 672 + 825, estimated: true },
      },
      {
        id: later,
        name: "Half term",
        startDate: "2026-10-19",
        days: 3,
        people: 2,
        mealsByDay: [0, 0, 0],
        averageKcal: null,
      },
    ]);
  });

  it("averages each person's kcal over the days planned, counting portions each", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 0, slot: "dinner", recipeId: tuna, portionsPerPerson: 1.5 });
    await addEntry(h.a, id, { dayIndex: 3, slot: "lunch", recipeId: tuna, portionsPerPerson: 0.5 });
    const [plan] = await listPlans(h.a);
    expect(plan.averageKcal).toEqual({ kcal: (672 * 1.5 + 672 * 0.5) / 2, estimated: false });
  });
});

describe("updatePlan", () => {
  it("changes the details; a new start date moves the entries with it", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 3, slot: "dinner", recipeId: tuna });
    const changed = { name: "Next week", startDate: "2026-10-19", days: 7, people: 3 };
    expect(await updatePlan(h.aMember, id, changed)).toEqual({ removedEntries: 0 });
    const plan = await getPlan(h.a, id);
    expect(plan).toMatchObject(changed);
    expect(plan?.entries.map((e) => e.dayIndex)).toEqual([3]);
  });

  it("removes the entries on days cut off by fewer days", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 4, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, id, { dayIndex: 5, slot: "breakfast", recipeId: tofoo });
    await addEntry(h.a, id, { dayIndex: 6, slot: "dinner", recipeId: tofoo });
    expect(await updatePlan(h.a, id, { ...thisWeek, days: 5 })).toEqual({ removedEntries: 2 });
    expect((await getPlan(h.a, id))?.entries.map((e) => e.dayIndex)).toEqual([4]);
  });

  it("returns null for an id that isn't a plan", async () => {
    expect(await updatePlan(h.a, crypto.randomUUID(), thisWeek)).toBeNull();
    expect(await updatePlan(h.a, "nope", thisWeek)).toBeNull();
  });
});

describe("deletePlan", () => {
  it("deletes the plan and its entries but not the recipes", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 0, slot: "dinner", recipeId: tuna });
    expect(await deletePlan(h.aMember, id)).toBe(true);
    expect(await getPlan(h.a, id)).toBeNull();
    expect(await mocks.db.select().from(mealPlanEntries)).toEqual([]);
    expect(await deletePlan(h.a, id)).toBe(false);
  });

  it("goes with the household's recipe: deleting a recipe removes its entries", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 0, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tofoo });
    await deleteRecipe(h.a, tuna);
    expect((await getPlan(h.a, id))?.entries.map((e) => e.recipe.slug)).toEqual(["char-siu-tofoo-noodles"]);
  });
});

describe("copyPlan", () => {
  it("makes a new plan with every entry on the same day and meal, in the same order", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 3, slot: "dinner", recipeId: tofoo, portionsPerPerson: 1.5 });
    await addEntry(h.a, id, { dayIndex: 3, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, id, { dayIndex: 6, slot: "snack", recipeId: tuna });
    const copy = await copyPlan(h.aMember, id, { name: "Copy of This week", startDate: "2026-10-19", days: 7, people: 2 });
    expect(copy).not.toBe(id);
    const plan = await getPlan(h.a, copy!);
    expect(plan).toMatchObject({ name: "Copy of This week", startDate: "2026-10-19" });
    expect(plan?.entries.map((e) => [e.dayIndex, e.slot, e.recipe.slug, e.portionsPerPerson])).toEqual([
      [3, "dinner", "char-siu-tofoo-noodles", 1.5],
      [3, "dinner", "lemony-tuna-tomato-caper-pasta", 1],
      [6, "snack", "lemony-tuna-tomato-caper-pasta", 1],
    ]);
    // The original is untouched.
    expect((await getPlan(h.a, id))?.entries).toHaveLength(3);
  });

  it("leaves out entries past the new plan's length", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, id, { dayIndex: 5, slot: "dinner", recipeId: tuna });
    const copy = await copyPlan(h.a, id, { ...thisWeek, days: 3 });
    expect((await getPlan(h.a, copy!))?.entries.map((e) => e.dayIndex)).toEqual([1]);
  });
});

describe("entries", () => {
  let plan: string;
  beforeEach(async () => {
    plan = await createPlan(h.a, { ...thisWeek, days: 3 });
  });

  it("adds with 1 portion each, and refuses a day outside the plan", async () => {
    expect(await addEntry(h.a, plan, { dayIndex: 2, slot: "dinner", recipeId: tuna })).toEqual(expect.any(String));
    expect(await addEntry(h.a, plan, { dayIndex: 3, slot: "dinner", recipeId: tuna })).toBeNull();
    expect((await getPlan(h.a, plan))?.entries.map((e) => e.portionsPerPerson)).toEqual([1]);
  });

  it("sets portions in halves from ½ to 4", async () => {
    const id = (await addEntry(h.a, plan, { dayIndex: 0, slot: "dinner", recipeId: tuna }))!;
    expect(await setEntryPortions(h.aMember, id, 1.5)).toBe(true);
    expect((await getPlan(h.a, plan))?.entries[0].portionsPerPerson).toBe(1.5);
    await expect(setEntryPortions(h.a, id, 0)).rejects.toThrow();
    await expect(setEntryPortions(h.a, id, 4.5)).rejects.toThrow();
    await expect(setEntryPortions(h.a, id, 1.25)).rejects.toThrow();
  });

  it("moves to another day and meal, after what's already there", async () => {
    const moving = (await addEntry(h.a, plan, { dayIndex: 0, slot: "dinner", recipeId: tuna }))!;
    await addEntry(h.a, plan, { dayIndex: 1, slot: "lunch", recipeId: tofoo });
    expect(await moveEntry(h.a, moving, { dayIndex: 1, slot: "lunch" })).toBe(true);
    expect((await getPlan(h.a, plan))?.entries.map((e) => [e.dayIndex, e.slot, e.recipe.slug])).toEqual([
      [1, "lunch", "char-siu-tofoo-noodles"],
      [1, "lunch", "lemony-tuna-tomato-caper-pasta"],
    ]);
    expect(await moveEntry(h.a, moving, { dayIndex: 3, slot: "lunch" })).toBe(false);
  });

  it("removes", async () => {
    const id = (await addEntry(h.a, plan, { dayIndex: 0, slot: "dinner", recipeId: tuna }))!;
    expect(await removeEntry(h.a, id)).toBe(true);
    expect(await removeEntry(h.a, id)).toBe(false);
    expect((await getPlan(h.a, plan))?.entries).toEqual([]);
  });
});

// Acting as household A, nothing of household B's can be read, changed or
// deleted by id, and B's recipes can't go into A's plans (PP-155, PP-170).
describe("leftovers (PP-180)", () => {
  // Tuna pasta serves 4: 2 people × 1 each leaves 2.
  let plan: string;
  let cook: string;

  beforeEach(async () => {
    plan = await createPlan(h.a, thisWeek);
    cook = (await addEntry(h.a, plan, { dayIndex: 0, slot: "dinner", recipeId: tuna }))!;
  });

  async function entry(planId: string, id: string) {
    return (await getPlan(h.a, planId))!.entries.find((e) => e.id === id)!;
  }

  it("plans leftovers from an earlier cook, 1 each, with the cook's recipe", async () => {
    const meal = await addLeftovers(h.a, plan, { dayIndex: 2, slot: "lunch", cookId: cook });
    expect(meal).not.toBeNull();
    const eaten = await entry(plan, meal!);
    expect(eaten).toMatchObject({
      dayIndex: 2,
      slot: "lunch",
      portionsPerPerson: 1,
      recipe: { id: tuna },
      leftoversOf: { entryId: cook, planId: plan, date: "2026-10-12", slot: "dinner", left: 0 },
      leftoversTo: [],
    });
    expect((await entry(plan, cook)).leftoversTo).toEqual([
      { entryId: meal, planId: plan, date: "2026-10-14", dayIndex: 2, slot: "lunch", servings: 2 },
    ]);
    expect((await entry(plan, cook)).leftoversOf).toBeNull();
  });

  it("can't plan more than is left", async () => {
    await addLeftovers(h.a, plan, { dayIndex: 1, slot: "lunch", cookId: cook, portionsPerPerson: 0.5 });
    // 1 left: everyone gets ½.
    const second = await addLeftovers(h.a, plan, { dayIndex: 2, slot: "lunch", cookId: cook });
    expect((await entry(plan, second!)).portionsPerPerson).toBe(0.5);
    // Nothing left.
    expect(await addLeftovers(h.a, plan, { dayIndex: 3, slot: "lunch", cookId: cook })).toBeNull();
    expect(await addLeftovers(h.a, plan, { dayIndex: 3, slot: "lunch", cookId: cook, portionsPerPerson: 0.5 })).toBeNull();
  });

  it("refuses a cook that isn't earlier, a leftovers meal as the cook, and a day outside the plan", async () => {
    expect(await addLeftovers(h.a, plan, { dayIndex: 0, slot: "dinner", cookId: cook })).toBeNull();
    expect(await addLeftovers(h.a, plan, { dayIndex: 0, slot: "lunch", cookId: cook })).toBeNull();
    expect(await addLeftovers(h.a, plan, { dayIndex: 7, slot: "lunch", cookId: cook })).toBeNull();
    const meal = await addLeftovers(h.a, plan, { dayIndex: 0, slot: "snack", cookId: cook, portionsPerPerson: 0.5 });
    expect(meal).not.toBeNull();
    expect(await addLeftovers(h.a, plan, { dayIndex: 1, slot: "lunch", cookId: meal!, portionsPerPerson: 0.5 })).toBeNull();
  });

  it("comes from this plan or the plan just before, not older or later ones", async () => {
    const next = await createPlan(h.a, { ...thisWeek, name: "Next week", startDate: "2026-10-19" });
    const after = await createPlan(h.a, { ...thisWeek, name: "Week after", startDate: "2026-10-26" });
    expect(await nextPlan(h.a, plan)).toMatchObject({ id: next, name: "Next week", startDate: "2026-10-19", days: 7, people: 2 });
    expect(await nextPlan(h.a, after)).toBeNull();

    expect(await addLeftovers(h.a, after, { dayIndex: 0, slot: "lunch", cookId: cook })).toBeNull();
    const meal = await addLeftovers(h.a, next, { dayIndex: 0, slot: "lunch", cookId: cook });
    expect((await entry(next, meal!)).leftoversOf).toMatchObject({ entryId: cook, planId: plan, date: "2026-10-12" });
    // The cook's plan lists it too, by its own date.
    expect((await entry(plan, cook)).leftoversTo).toEqual([
      { entryId: meal, planId: next, date: "2026-10-19", dayIndex: 0, slot: "lunch", servings: 2 },
    ]);

    // A later plan's cook can't feed an earlier plan.
    const later = (await addEntry(h.a, next, { dayIndex: 0, slot: "breakfast", recipeId: tuna }))!;
    expect(await addLeftovers(h.a, plan, { dayIndex: 6, slot: "dinner", cookId: later })).toBeNull();
  });

  it("counts each plan's own people", async () => {
    // A 1-person plan next week takes 1 serving at 1 each, leaving 1.
    const next = await createPlan(h.a, { ...thisWeek, startDate: "2026-10-19", people: 1 });
    const meal = await addLeftovers(h.a, next, { dayIndex: 0, slot: "lunch", cookId: cook });
    expect((await entry(next, meal!)).leftoversOf?.left).toBe(1);
  });

  it("lists what's left to plan before a meal, oldest first", async () => {
    const tofu = (await addEntry(h.a, plan, { dayIndex: 1, slot: "dinner", recipeId: tofoo }))!; // serves 2: none left
    const later = (await addEntry(h.a, plan, { dayIndex: 3, slot: "dinner", recipeId: tuna }))!;
    const before = await createPlan(h.a, { ...thisWeek, name: "Last week", startDate: "2026-10-05" });
    const old = (await addEntry(h.a, before, { dayIndex: 5, slot: "dinner", recipeId: tuna }))!;
    const older = await createPlan(h.a, { ...thisWeek, name: "Long ago", startDate: "2026-09-28" });
    await addEntry(h.a, older, { dayIndex: 0, slot: "dinner", recipeId: tuna });

    const found = await availableLeftovers(h.a, plan, { dayIndex: 2, slot: "lunch" });
    expect(found.map((f) => [f.cookId, f.date, f.slot, f.left])).toEqual([
      [old, "2026-10-10", "dinner", 2],
      [cook, "2026-10-12", "dinner", 2],
    ]);
    expect(found[0].recipe).toMatchObject({ id: tuna, slug: "lemony-tuna-tomato-caper-pasta", kcal: expect.any(Number) });
    expect(found.map((f) => f.cookId)).not.toContain(tofu);
    expect(found.map((f) => f.cookId)).not.toContain(later);

    // Once planned, it's gone.
    await addLeftovers(h.a, plan, { dayIndex: 1, slot: "lunch", cookId: cook });
    expect((await availableLeftovers(h.a, plan, { dayIndex: 2, slot: "lunch" })).map((f) => f.cookId)).toEqual([old]);
  });

  it("caps a leftovers meal's portions at what's left, and a cook's at what its leftovers need", async () => {
    const meal = (await addLeftovers(h.a, plan, { dayIndex: 1, slot: "lunch", cookId: cook, portionsPerPerson: 0.5 }))!;
    expect(await setEntryPortions(h.a, meal, 1.5)).toBe(false);
    expect(await setEntryPortions(h.a, meal, 1)).toBe(true);
    // The cook can't eat into the planned 2, but can go down.
    expect(await setEntryPortions(h.a, cook, 1.5)).toBe(false);
    expect(await setEntryPortions(h.a, cook, 0.5)).toBe(true);
    expect(await setEntryPortions(h.a, cook, 1)).toBe(true);
    // Without leftovers planned, a cook can be planned past what it makes, as before.
    await removeEntry(h.a, meal);
    expect(await setEntryPortions(h.a, cook, 3)).toBe(true);
  });

  it("shows over-planned leftovers when the plan's people go up", async () => {
    const meal = (await addLeftovers(h.a, plan, { dayIndex: 1, slot: "lunch", cookId: cook }))!;
    await updatePlan(h.a, plan, { ...thisWeek, people: 3 });
    // Serves 4, 3 eat 1 each at the cook, 3 planned as leftovers: 2 over.
    expect((await entry(plan, meal)).leftoversOf?.left).toBe(-2);
    // A cook already over can still go down.
    expect(await setEntryPortions(h.a, cook, 0.5)).toBe(true);
  });

  it("keeps a leftovers meal after its cook, and a cook before its leftovers, when moving", async () => {
    const meal = (await addLeftovers(h.a, plan, { dayIndex: 2, slot: "lunch", cookId: cook }))!;
    expect(await moveEntry(h.a, meal, { dayIndex: 0, slot: "lunch" })).toBe(false);
    expect(await moveEntry(h.a, meal, { dayIndex: 0, slot: "dinner" })).toBe(false);
    expect(await moveEntry(h.a, meal, { dayIndex: 0, slot: "snack" })).toBe(true);
    expect(await moveEntry(h.a, cook, { dayIndex: 1, slot: "dinner" })).toBe(false);
    expect(await moveEntry(h.a, cook, { dayIndex: 0, slot: "lunch" })).toBe(true);
  });

  it("removes leftovers meals with their cook, in any plan", async () => {
    const next = await createPlan(h.a, { ...thisWeek, startDate: "2026-10-19" });
    await addLeftovers(h.a, plan, { dayIndex: 1, slot: "lunch", cookId: cook, portionsPerPerson: 0.5 });
    await addLeftovers(h.a, next, { dayIndex: 0, slot: "lunch", cookId: cook, portionsPerPerson: 0.5 });
    expect(await removeEntry(h.a, cook)).toBe(true);
    expect((await getPlan(h.a, plan))?.entries).toEqual([]);
    expect((await getPlan(h.a, next))?.entries).toEqual([]);
  });

  it("removes next week's leftovers meals when the cook's plan is deleted or shortened", async () => {
    const next = await createPlan(h.a, { ...thisWeek, startDate: "2026-10-19" });
    const late = (await addEntry(h.a, plan, { dayIndex: 6, slot: "dinner", recipeId: tuna }))!;
    await addLeftovers(h.a, next, { dayIndex: 0, slot: "lunch", cookId: late });
    await updatePlan(h.a, plan, { ...thisWeek, days: 6 });
    expect((await getPlan(h.a, next))?.entries).toEqual([]);
    await addLeftovers(h.a, next, { dayIndex: 0, slot: "lunch", cookId: cook });
    await deletePlan(h.a, plan);
    expect((await getPlan(h.a, next))?.entries).toEqual([]);
  });

  it("copies leftovers meals with their cooks, but not ones from the plan before", async () => {
    const before = await createPlan(h.a, { ...thisWeek, startDate: "2026-10-05" });
    const old = (await addEntry(h.a, before, { dayIndex: 6, slot: "dinner", recipeId: tuna }))!;
    await addLeftovers(h.a, plan, { dayIndex: 2, slot: "lunch", cookId: cook });
    await addLeftovers(h.a, plan, { dayIndex: 0, slot: "lunch", cookId: old });
    const copy = await copyPlan(h.a, plan, { ...thisWeek, startDate: "2026-10-19" });
    const entries = (await getPlan(h.a, copy!))!.entries;
    expect(entries.map((e) => [e.dayIndex, e.slot, e.leftoversOf?.entryId ?? null])).toEqual([
      [0, "dinner", null],
      [2, "lunch", entries[0].id],
    ]);
    expect(entries[0].leftoversTo).toHaveLength(1);
  });
});

describe("recipePlanUses (import design H)", () => {
  it("lists the plans a recipe is in, by date, with its meals in order", async () => {
    const later = await createPlan(h.a, { ...thisWeek, name: "Half-term", startDate: "2026-10-26" });
    const week = await createPlan(h.a, thisWeek);
    await addEntry(h.a, later, { dayIndex: 3, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, later, { dayIndex: 0, slot: "lunch", recipeId: tuna });
    await addEntry(h.a, week, { dayIndex: 1, slot: "dinner", recipeId: tuna });
    // The same meal twice (a second portion) is named once; other recipes don't count.
    await addEntry(h.a, week, { dayIndex: 1, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, week, { dayIndex: 2, slot: "dinner", recipeId: tofoo });
    expect(await recipePlanUses(h.a, tuna)).toEqual([
      { id: week, name: "This week", startDate: "2026-10-12", meals: [{ dayIndex: 1, slot: "dinner" }] },
      {
        id: later,
        name: "Half-term",
        startDate: "2026-10-26",
        meals: [
          { dayIndex: 0, slot: "lunch" },
          { dayIndex: 3, slot: "dinner" },
        ],
      },
    ]);
  });

  it("is empty for a recipe in no plan, or an id that isn't one", async () => {
    expect(await recipePlanUses(h.a, tofoo)).toEqual([]);
    expect(await recipePlanUses(h.a, "not-a-uuid")).toEqual([]);
  });

  it("deleting a planned recipe leaves no plan entries or household data behind (PP-165)", async () => {
    const week = await createPlan(h.a, thisWeek);
    await addEntry(h.a, week, { dayIndex: 1, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, week, { dayIndex: 2, slot: "dinner", recipeId: tofoo });
    await setRating(h.a, tuna, 4);
    await setNotes(h.a, tuna, "Extra capers");
    await markCooked(h.a, tuna, "2026-10-02");
    expect(await deleteRecipe(h.a, tuna)).toBe(true);
    const entries = await mocks.db.select({ recipeId: mealPlanEntries.recipeId }).from(mealPlanEntries);
    expect(entries).toEqual([{ recipeId: tofoo }]);
    expect(await mocks.db.select().from(recipeHouseholdData)).toEqual([]);
    expect(await mocks.db.select().from(recipeCooks)).toEqual([]);
    expect(await recipePlanUses(h.a, tuna)).toEqual([]);
  });
});

describe("household isolation", () => {
  let bPlan: string;
  let bRecipe: string;
  let bEntry: string;
  let aPlan: string;

  beforeEach(async () => {
    bRecipe = (await saveRecipe(h.b, tunaPasta)).id;
    bPlan = await createPlan(h.b, { ...thisWeek, name: "B's week" });
    bEntry = (await addEntry(h.b, bPlan, { dayIndex: 0, slot: "dinner", recipeId: bRecipe }))!;
    aPlan = await createPlan(h.a, thisWeek);
  });

  it("A can't see which of B's plans B's recipe is in", async () => {
    expect(await recipePlanUses(h.a, bRecipe)).toEqual([]);
    expect(await recipePlanUses(h.b, bRecipe)).toHaveLength(1);
  });

  async function bUnchanged() {
    expect(await getPlan(h.b, bPlan)).toMatchObject({
      name: "B's week",
      startDate: "2026-10-12",
      days: 7,
      people: 2,
      entries: [{ id: bEntry, dayIndex: 0, slot: "dinner", portionsPerPerson: 1 }],
    });
  }

  it("doesn't list or find B's plans", async () => {
    expect((await listPlans(h.a)).map((p) => p.id)).toEqual([aPlan]);
    // B's meals don't count towards A's totals.
    expect((await listPlans(h.a))[0]).toMatchObject({ mealsByDay: [0, 0, 0, 0, 0, 0, 0], averageKcal: null });
    expect(await getPlan(h.a, bPlan)).toBeNull();
    expect(await getPlan(h.aMember, bPlan)).toBeNull();
  });

  it("doesn't change, copy or delete B's plans", async () => {
    expect(await updatePlan(h.a, bPlan, { ...thisWeek, name: "Mine now", days: 1 })).toBeNull();
    expect(await copyPlan(h.a, bPlan, thisWeek)).toBeNull();
    expect(await deletePlan(h.a, bPlan)).toBe(false);
    expect((await listPlans(h.a)).map((p) => p.id)).toEqual([aPlan]);
    await bUnchanged();
  });

  it("doesn't add to, change, move or remove B's entries", async () => {
    expect(await addEntry(h.a, bPlan, { dayIndex: 1, slot: "lunch", recipeId: tuna })).toBeNull();
    expect(await setEntryPortions(h.a, bEntry, 2)).toBe(false);
    expect(await moveEntry(h.a, bEntry, { dayIndex: 2, slot: "lunch" })).toBe(false);
    expect(await removeEntry(h.a, bEntry)).toBe(false);
    await bUnchanged();
  });

  it("doesn't put B's recipe in A's plan", async () => {
    expect(await addEntry(h.a, aPlan, { dayIndex: 0, slot: "dinner", recipeId: bRecipe })).toBeNull();
    expect((await getPlan(h.a, aPlan))?.entries).toEqual([]);
  });
  it("doesn't plan, list or see leftovers across households", async () => {
    const aCook = (await addEntry(h.a, aPlan, { dayIndex: 0, slot: "dinner", recipeId: tuna }))!;
    // A can't eat B's leftovers, or put leftovers in B's plan.
    expect(await addLeftovers(h.a, aPlan, { dayIndex: 1, slot: "lunch", cookId: bEntry })).toBeNull();
    expect(await addLeftovers(h.a, bPlan, { dayIndex: 1, slot: "lunch", cookId: bEntry })).toBeNull();
    expect(await addLeftovers(h.a, bPlan, { dayIndex: 1, slot: "lunch", cookId: aCook })).toBeNull();
    expect(await addLeftovers(h.b, bPlan, { dayIndex: 1, slot: "lunch", cookId: aCook })).toBeNull();
    expect(await availableLeftovers(h.a, bPlan, { dayIndex: 1, slot: "lunch" })).toEqual([]);
    expect((await availableLeftovers(h.a, aPlan, { dayIndex: 1, slot: "lunch" })).map((f) => f.cookId)).toEqual([aCook]);
    expect(await nextPlan(h.a, bPlan)).toBeNull();
    // B's own leftovers are untouched by A, and don't show in A's plan.
    const bMeal = (await addLeftovers(h.b, bPlan, { dayIndex: 1, slot: "lunch", cookId: bEntry }))!;
    expect(await setEntryPortions(h.a, bMeal, 0.5)).toBe(false);
    expect(await moveEntry(h.a, bMeal, { dayIndex: 2, slot: "lunch" })).toBe(false);
    expect(await removeEntry(h.a, bMeal)).toBe(false);
    expect((await getPlan(h.a, aPlan))?.entries.map((e) => e.leftoversTo)).toEqual([[]]);
    expect((await getPlan(h.b, bPlan))?.entries.map((e) => e.leftoversOf?.entryId ?? null)).toEqual([null, bEntry]);
  });
});
