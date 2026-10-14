import { describe, expect, it } from "vitest";
import {
  dayTotals,
  entryLine,
  entryNutrition,
  grams,
  kcal,
  leftOver,
  leftovers,
  planAverage,
  whole,
  type NutritionEntry,
} from "./nutrition";

function recipe(name: string, kcal: number, proteinG: number, carbsG: number, fatG: number, estimated = false) {
  return { name, kcal, proteinG, carbsG, fatG, nutritionSource: estimated ? ("estimated" as const) : ("printed" as const) };
}

const pasta = recipe("Lemony tuna pasta", 672, 29, 83, 23);
const noodles = recipe("Char siu Tofoo noodles", 825, 31, 92, 34, true);
const salad = recipe("Tuna niçoise salad", 450, 32, 20, 26);
const chicken = recipe("Sticky chicken thighs", 610, 42, 72, 15);
const curry = recipe("Chickpea curry", 480, 17, 52, 22);
const flatbreads = recipe("Garlic flatbreads", 160, 3, 27, 4);
const prawns = recipe("Prawn linguine", 540, 31, 68, 14);
const oats = recipe("Overnight oats", 350, 13, 50, 10);
const bake = recipe("Mackerel pasta bake", 590, 27, 60, 27, true);

const entry = (dayIndex: number, r: NutritionEntry["recipe"], portionsPerPerson = 1): NutritionEntry => ({
  dayIndex,
  portionsPerPerson,
  recipe: r,
});

// The design's week: 7 days for 2 people, Sunday left empty.
const week: NutritionEntry[] = [
  entry(0, pasta),
  entry(1, noodles),
  entry(2, salad),
  entry(2, chicken),
  entry(3, curry, 1.5),
  entry(3, flatbreads),
  entry(4, prawns),
  entry(5, oats),
  entry(5, bake),
];

describe("entry nutrition", () => {
  it("is nutrition per serving × portions each", () => {
    expect(entryNutrition(entry(3, curry, 1.5))).toEqual({
      kcal: 720,
      proteinG: 25.5,
      carbsG: 78,
      fatG: 33,
      estimated: false,
    });
    expect(entryNutrition(entry(0, pasta, 0.5)).kcal).toBe(336);
    expect(entryNutrition(entry(1, noodles)).estimated).toBe(true);
  });

  it("reads as the plan's recipe rows do", () => {
    expect(entryLine(entry(3, curry, 1.5))).toBe("1½ each · 720 kcal · 26g protein");
    expect(entryLine(entry(1, noodles))).toBe("1 each · ~825 kcal · ~31g protein");
  });
});

describe("a 7-day plan for 2 people", () => {
  it("has correct per-person daily totals", () => {
    const totals = Array.from({ length: 7 }, (_, day) => dayTotals(week, day));
    expect(totals).toEqual([
      { kcal: 672, proteinG: 29, carbsG: 83, fatG: 23, estimated: false },
      { kcal: 825, proteinG: 31, carbsG: 92, fatG: 34, estimated: true },
      { kcal: 1060, proteinG: 74, carbsG: 92, fatG: 41, estimated: false },
      { kcal: 880, proteinG: 28.5, carbsG: 105, fatG: 37, estimated: false },
      { kcal: 540, proteinG: 31, carbsG: 68, fatG: 14, estimated: false },
      { kcal: 940, proteinG: 40, carbsG: 110, fatG: 37, estimated: true },
      null,
    ]);
  });

  it("averages over the days with something planned, and says how many", () => {
    const average = planAverage(week, 7);
    expect(average?.daysPlanned).toBe(6);
    expect(average?.kcal).toBeCloseTo((672 + 825 + 1060 + 880 + 540 + 940) / 6);
    expect(average?.proteinG).toBeCloseTo((29 + 31 + 74 + 28.5 + 31 + 40) / 6);
    expect(average?.estimated).toBe(true);
    expect(kcal(average!)).toBe("~820 kcal");
  });

  it("isn't estimated when every recipe's nutrition is printed", () => {
    expect(planAverage(week.filter((e) => e.recipe.nutritionSource === "printed"), 7)?.estimated).toBe(false);
  });

  it("has no average with nothing planned", () => {
    expect(planAverage([], 7)).toBeNull();
  });

  it("ignores entries past the plan's last day", () => {
    expect(planAverage([entry(0, pasta), entry(9, noodles)], 7)).toMatchObject({ kcal: 672, daysPlanned: 1 });
  });
});

describe("leftovers", () => {
  it("counts the servings the people don't eat", () => {
    expect(leftovers(4, 2, 1)).toBe(2);
    expect(leftovers(4, 2, 1.5)).toBe(1);
    expect(leftovers(6, 3, 1.5)).toBe(1.5);
    expect(leftovers(4, 2, 2)).toBe(0);
  });

  it("isn't negative when more is planned than the recipe makes", () => {
    expect(leftovers(4, 3, 1.5)).toBe(0);
  });

  it("reads as the badges do", () => {
    expect(leftOver(2)).toBe("2 left over");
    expect(leftOver(0.5)).toBe("½ left over");
    expect(leftOver(1.5)).toBe("1½ left over");
  });
});

describe("formatting", () => {
  it("rounds to whole numbers with thousands separated", () => {
    expect(whole(1060)).toBe("1,060");
    expect(whole(819.5)).toBe("820");
    expect(grams(28.95, false)).toBe("29g");
    expect(grams(31, true)).toBe("~31g");
  });
});
