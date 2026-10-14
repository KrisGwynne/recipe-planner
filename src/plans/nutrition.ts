import { approx } from "@/lib/format";
import { formatPortions, servingsPlanned } from "./plan";

// Meal plan totals and leftovers (PP-172, designs/meal-plans.html D, F, G, H
// and I). Everything is per person: a recipe's nutrition per serving × that
// person's portions (handover section 5), added up per day. Sums use the
// exact numbers and are only rounded for display (Kris, 2026-10-14).

/** What the totals need of a planned recipe. */
export type NutritionEntry = {
  dayIndex: number;
  portionsPerPerson: number;
  recipe: {
    name: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    nutritionSource: "printed" | "estimated";
  };
};

export type Totals = { kcal: number; proteinG: number; carbsG: number; fatG: number; estimated: boolean };

const zero: Totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, estimated: false };

/** What one person eats of a planned recipe: nutrition per serving × portions each. */
export function entryNutrition(entry: NutritionEntry): Totals {
  const { recipe, portionsPerPerson: p } = entry;
  return {
    kcal: recipe.kcal * p,
    proteinG: recipe.proteinG * p,
    carbsG: recipe.carbsG * p,
    fatG: recipe.fatG * p,
    estimated: recipe.nutritionSource === "estimated",
  };
}

function add(a: Totals, b: Totals): Totals {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
    estimated: a.estimated || b.estimated,
  };
}

/** One person's total for a day; null when nothing is planned that day. */
export function dayTotals(entries: NutritionEntry[], dayIndex: number): Totals | null {
  const day = entries.filter((e) => e.dayIndex === dayIndex);
  return day.length === 0 ? null : day.map(entryNutrition).reduce(add, zero);
}

/**
 * One person's day on average, over the days with at least one meal planned,
 * so an empty day doesn't drag it down (Kris, 2026-10-13). Null when nothing
 * is planned at all.
 */
export function planAverage(entries: NutritionEntry[], days: number): (Totals & { daysPlanned: number }) | null {
  const totals = Array.from({ length: days }, (_, i) => dayTotals(entries, i)).filter((t) => t !== null);
  if (totals.length === 0) return null;
  const sum = totals.reduce(add, zero);
  const n = totals.length;
  return {
    kcal: sum.kcal / n,
    proteinG: sum.proteinG / n,
    carbsG: sum.carbsG / n,
    fatG: sum.fatG / n,
    estimated: sum.estimated,
    daysPlanned: n,
  };
}

/**
 * Servings left over when the people eating a recipe don't finish it
 * (people × portions each is less than it serves), else 0. Each planned
 * recipe is worked out on its own (Kris, 2026-10-13). Planning more than the
 * recipe makes isn't flagged: its Recipe button opens it scaled up (Kris,
 * 2026-10-14).
 */
export function leftovers(serves: number, people: number, portionsPerPerson: number): number {
  return Math.max(0, serves - servingsPlanned(people, portionsPerPerson));
}

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** "672", "1,060": kcal and grams are shown as whole numbers. */
export function whole(n: number): string {
  return number.format(Math.round(n));
}

/** "672 kcal", "~825 kcal". */
export function kcal(totals: Pick<Totals, "kcal" | "estimated">): string {
  return approx(`${whole(totals.kcal)} kcal`, totals.estimated);
}

/** "29g", "~31g". */
export function grams(n: number, estimated: boolean): string {
  return approx(`${whole(n)}g`, estimated);
}

/** "2 left over", "½ left over". */
export function leftOver(n: number): string {
  return `${formatPortions(n)} left over`;
}

/** "1½ each · 720 kcal · 26g protein": a planned recipe's row (design D). */
export function entryLine(entry: NutritionEntry): string {
  const n = entryNutrition(entry);
  return `${formatPortions(entry.portionsPerPerson)} each · ${kcal(n)} · ${grams(n.proteinG, n.estimated)} protein`;
}

/** The estimated recipes in a plan, each named once, in plan order (design H's footnote). */
export function estimatedRecipes(entries: NutritionEntry[]): string[] {
  return [...new Set(entries.filter((e) => e.recipe.nutritionSource === "estimated").map((e) => e.recipe.name))];
}

/** "Tue", "Tue and Sat", "Mon, Tue and Sat". */
export function andList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
