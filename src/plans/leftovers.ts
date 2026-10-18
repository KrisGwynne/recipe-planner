import { MAX_PORTIONS, MIN_PORTIONS, addDays, formatDay, formatPortions, servingsPlanned, type Slot } from "./plan";

// Leftovers in a plan (PP-180, designs/leftovers.html). A planned recipe is a
// cook or a leftovers meal eating from an earlier cook, in this plan or the
// plan just before. What a cook has left is the recipe's servings less its
// own and its leftovers meals' (each counted with its own plan's people).

/** Where a cook's leftovers go, as getPlan returns them. */
export type LeftoversMeal = { entryId: string; planId: string; date: string; dayIndex: number; slot: Slot; servings: number };

/** Where a leftovers meal comes from, and what its cook still has left besides. */
export type LeftoversSource = { entryId: string; planId: string; date: string; slot: Slot; left: number };

type Cook = {
  portionsPerPerson: number;
  recipe: { serves: number };
  leftoversOf: LeftoversSource | null;
  leftoversTo: LeftoversMeal[];
};

/** Servings planned as leftovers of a cook. */
export function plannedLeftovers(entry: Pick<Cook, "leftoversTo">): number {
  return entry.leftoversTo.reduce((sum, meal) => sum + meal.servings, 0);
}

/**
 * What a cook has left that isn't planned: below 0 when more is planned than
 * it makes (the plan's people went up, Kris 2026-10-18). Always 0 for a
 * leftovers meal, which has no leftovers of its own.
 */
export function unplanned(entry: Cook, people: number): number {
  if (entry.leftoversOf) return 0;
  const left = entry.recipe.serves - servingsPlanned(people, entry.portionsPerPerson);
  // A cook planned past what it makes, with nothing planned from it, isn't flagged (2026-10-14).
  if (entry.leftoversTo.length === 0) return Math.max(0, left);
  return left - plannedLeftovers(entry);
}

/** Portions each, in halves, that `servings` covers for `people`. */
function halvesFor(servings: number, people: number): number {
  return Math.floor((servings * 2) / people) / 2;
}

/**
 * The most portions each a cook can go up to: anything while nothing is
 * planned from it, else no more than leaves its planned leftovers whole
 * (leftovers design B). Never below where it is now.
 */
export function maxCookPortions(entry: Cook, people: number): number {
  if (entry.leftoversTo.length === 0) return MAX_PORTIONS;
  const room = halvesFor(entry.recipe.serves - plannedLeftovers(entry), people);
  return Math.min(MAX_PORTIONS, Math.max(entry.portionsPerPerson, room, MIN_PORTIONS));
}

/** The most portions each a leftovers meal can have: its own plus what the cook has left (design E). */
export function maxLeftoverPortions(entry: Cook, people: number): number {
  const left = entry.leftoversOf?.left ?? 0;
  const room = halvesFor(servingsPlanned(people, entry.portionsPerPerson) + left, people);
  return Math.min(MAX_PORTIONS, Math.max(entry.portionsPerPerson, room));
}

/**
 * Portions each a new leftovers meal starts at (design C): 1, or less when
 * fewer are left; null when there isn't even ½ each.
 */
export function startingPortions(left: number, people: number): number | null {
  const each = Math.min(1, halvesFor(left, people));
  return each < MIN_PORTIONS ? null : each;
}

/** The most portions each `left` servings allow, for the Plan them stepper. */
export function mostPortions(left: number, people: number): number {
  return Math.min(MAX_PORTIONS, halvesFor(left, people));
}

/** "Mon dinner" in the same plan, "Sat 10 dinner" in another (design A). */
export function mealLabel(meal: { planId: string; date: string; slot: Slot }, planId: string): string {
  const [weekday, day] = formatDay(meal.date).split(" ");
  return meal.planId === planId ? `${weekday} ${meal.slot}` : `${weekday} ${day} ${meal.slot}`;
}

/** "2 for Wed lunch" on a cook (design A). */
export function leftoversFor(meal: LeftoversMeal, planId: string): string {
  return `${formatPortions(meal.servings)} for ${mealLabel(meal, planId)}`;
}

/** "1 more planned than left over" (Kris, 2026-10-18). */
export function overPlanned(n: number): string {
  return `${formatPortions(-n)} more planned than left over`;
}

/**
 * How many days old leftovers will be by the meal, when it's 2 or more (the
 * picker's amber warning, design D: food safety advice is to eat them within
 * 2 days), else null.
 */
export function daysOld(cookDate: string, mealDate: string): number | null {
  let days = 0;
  while (addDays(cookDate, days) < mealDate) days++;
  return days >= 2 ? days : null;
}
