// Scaled ingredient amounts for the recipe page (PP-168, designs/src/recipe.html
// B): qty × target / serves, shown as a cook would write them. Pure.
import type { Ingredient } from "@/types/recipe";
import { scaleQty } from "./derive";

const METRIC_WHOLE = new Set(["g", "ml"]);
const METRIC_DECIMAL = new Set(["kg", "l"]);
const PLURALS: Record<string, string> = {
  cup: "cups",
  pinch: "pinches",
  handful: "handfuls",
  bunch: "bunches",
  can: "cans",
  jar: "jars",
  pack: "packs",
  clove: "cloves",
  slice: "slices",
  sprig: "sprigs",
  sheet: "sheets",
  piece: "pieces",
};
const FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [1, ""],
];

/** 1.5 -> "1½", 0.25 -> "¼", 2 -> "2"; one decimal place if no kitchen fraction is close. */
export function kitchenNumber(value: number): string {
  const whole = Math.floor(value);
  const rest = value - whole;
  const [fraction, glyph] = FRACTIONS.reduce((best, f) => (Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best));
  if (Math.abs(fraction - rest) <= 0.04) {
    const w = fraction === 1 ? whole + 1 : whole;
    if (w === 0 && glyph === "") return decimal(value, 2);
    return `${w > 0 ? w : ""}${glyph}`;
  }
  return decimal(value, 1);
}

function decimal(value: number, places: number): string {
  return String(Number(value.toFixed(places)));
}

/** "250 g", "1½ tbsp", "½", "2 cans"; "" when there's no quantity ("to taste"). */
export function formatAmount(qty: number | null, unit: Ingredient["unit"]): string {
  if (qty === null) return unit ?? "";
  if (unit === null) return kitchenNumber(qty);
  if (METRIC_WHOLE.has(unit)) return `${qty >= 10 ? Math.round(qty) : decimal(qty, 1)} ${unit}`;
  // Below one kilo or litre, grams or millilitres read better ("500 ml", not "0.5 l").
  if (METRIC_DECIMAL.has(unit)) return qty < 1 ? formatAmount(qty * 1000, unit === "kg" ? "g" : "ml") : `${decimal(qty, 2)} ${unit}`;
  const number = kitchenNumber(qty);
  return `${number} ${qty > 1 && PLURALS[unit] ? PLURALS[unit] : unit}`;
}

/** An ingredient's amount at `target` servings. */
export function scaledAmount(ingredient: Ingredient, serves: number, target: number): string {
  return formatAmount(scaleQty(ingredient.qty, serves, target), ingredient.unit);
}

/** "220g total", scaled; undefined without grams. */
export function gramsTotal(ingredient: Ingredient, serves: number, target: number): string | undefined {
  if (ingredient.grams === undefined) return undefined;
  return `${Math.round((ingredient.grams * target) / serves)}g total`;
}

/**
 * Notes text never scales, so when the recipe is scaled, notes with amounts in
 * them say which servings they're written for: "(for 4)".
 */
export function notesFor(ingredient: Ingredient, serves: number, target: number): { text: string; forServes?: number } | undefined {
  if (!ingredient.notes) return undefined;
  return target !== serves && /\d/.test(ingredient.notes) ? { text: ingredient.notes, forServes: serves } : { text: ingredient.notes };
}

/** "Halved from 4 servings" etc.; undefined at the recipe's own servings. */
export function scaledBanner(serves: number, target: number): string | undefined {
  if (target === serves) return undefined;
  const servings = serves === 1 ? "1 serving" : `${serves} servings`;
  if (target * 2 === serves) return `Halved from ${servings}`;
  if (target === serves * 2) return `Doubled from ${servings}`;
  return `Scaled from ${servings}`;
}

/** Ingredients without a group first, then each group in file order. */
export function groupIngredients(ingredients: Ingredient[]): { group: string | null; items: { ingredient: Ingredient; index: number }[] }[] {
  const groups = new Map<string | null, { ingredient: Ingredient; index: number }[]>([[null, []]]);
  ingredients.forEach((ingredient, index) => {
    const key = ingredient.group ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ ingredient, index });
  });
  return [...groups].filter(([, items]) => items.length > 0).map(([group, items]) => ({ group, items }));
}
