import { describe, expect, it } from "vitest";
import {
  daysOld,
  leftoversFor,
  maxCookPortions,
  maxLeftoverPortions,
  mealLabel,
  mostPortions,
  overPlanned,
  plannedLeftovers,
  startingPortions,
  unplanned,
} from "./leftovers";

const meal = (servings: number, planId = "this", date = "2026-10-14") => ({
  entryId: `m${servings}`,
  planId,
  date,
  dayIndex: 2,
  slot: "lunch" as const,
  servings,
});

const cook = (serves: number, portionsPerPerson: number, to: ReturnType<typeof meal>[] = []) => ({
  portionsPerPerson,
  recipe: { serves },
  leftoversOf: null,
  leftoversTo: to,
});

const eating = (portionsPerPerson: number, left: number) => ({
  portionsPerPerson,
  recipe: { serves: 4 },
  leftoversOf: { entryId: "c", planId: "this", date: "2026-10-12", slot: "dinner" as const, left },
  leftoversTo: [],
});

describe("unplanned", () => {
  it("is what the cook makes less its own servings and its leftovers meals'", () => {
    expect(unplanned(cook(8, 1), 2)).toBe(6);
    expect(unplanned(cook(8, 1, [meal(2)]), 2)).toBe(4);
    expect(plannedLeftovers(cook(8, 1, [meal(2), meal(1.5)]))).toBe(3.5);
    expect(unplanned(cook(4, 1, [meal(2)]), 2)).toBe(0);
  });

  it("goes below 0 only when leftovers are planned (people went up)", () => {
    expect(unplanned(cook(4, 1, [meal(2)]), 3)).toBe(-1);
    expect(unplanned(cook(4, 3), 2)).toBe(0);
  });

  it("is 0 for a leftovers meal", () => {
    expect(unplanned(eating(1, 2), 2)).toBe(0);
  });
});

describe("portion limits", () => {
  it("lets a cook go anywhere until leftovers are planned, then no further than leaves them whole", () => {
    expect(maxCookPortions(cook(4, 1), 2)).toBe(4);
    expect(maxCookPortions(cook(8, 1, [meal(2)]), 2)).toBe(3);
    expect(maxCookPortions(cook(4, 1, [meal(2)]), 2)).toBe(1);
    // Already over: it stays where it is.
    expect(maxCookPortions(cook(4, 1, [meal(2)]), 3)).toBe(1);
  });

  it("lets a leftovers meal take its own and what's left", () => {
    expect(maxLeftoverPortions(eating(1, 0), 2)).toBe(1);
    expect(maxLeftoverPortions(eating(0.5, 1), 2)).toBe(1);
    expect(maxLeftoverPortions(eating(1, 10), 2)).toBe(4);
  });

  it("starts new leftovers at 1 each, or less when fewer are left", () => {
    expect(startingPortions(4, 2)).toBe(1);
    expect(startingPortions(1, 2)).toBe(0.5);
    expect(startingPortions(1.5, 2)).toBe(0.5);
    expect(startingPortions(0.5, 2)).toBeNull();
    expect(mostPortions(4, 2)).toBe(2);
    expect(mostPortions(20, 2)).toBe(4);
  });
});

describe("labels", () => {
  it("names meals by weekday in this plan, adding the date in another", () => {
    expect(mealLabel(meal(2), "this")).toBe("Wed lunch");
    expect(mealLabel({ planId: "last", date: "2026-10-10", slot: "dinner" }, "this")).toBe("Sat 10 dinner");
    expect(leftoversFor(meal(2), "this")).toBe("2 for Wed lunch");
    expect(leftoversFor(meal(1.5, "next", "2026-10-19"), "this")).toBe("1½ for Mon 19 lunch");
    expect(overPlanned(-1)).toBe("1 more planned than left over");
  });

  it("warns when leftovers will be 2 or more days old by the meal", () => {
    expect(daysOld("2026-10-12", "2026-10-12")).toBeNull();
    expect(daysOld("2026-10-12", "2026-10-13")).toBeNull();
    expect(daysOld("2026-10-12", "2026-10-14")).toBe(2);
    expect(daysOld("2026-10-10", "2026-10-14")).toBe(4);
  });
});
