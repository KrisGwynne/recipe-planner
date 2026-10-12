// What re-importing a recipe changes (import design, screen D): each part of
// the recipe that differs, with before → after where that's short enough to
// read, otherwise just "changed". Pure, so the review screen can show it.
import { formatMinutes } from "@/lib/format";
import type { Ingredient, Recipe } from "@/types/recipe";
import { totalMins } from "./derive";

export type DiffLine =
  | { kind: "change"; label?: string; before: string; after: string }
  | { kind: "added"; text: string }
  | { kind: "removed"; text: string }
  | { kind: "changed"; label?: string };

/** One part of the recipe that differs, e.g. "Times" with its lines. */
export type Change = { field: keyof Recipe; label: string; lines: DiffLine[] };

/** True when two recipes are the same, whatever the order of their keys. */
export function sameRecipe(a: Recipe, b: Recipe): boolean {
  return canonical(a) === canonical(b);
}

/** Every part of `after` that differs from `before`, in the schema's order. */
export function diffRecipes(before: Recipe, after: Recipe): Change[] {
  const changes: Change[] = [];
  for (const [field, label] of fields) {
    if (canonical(before[field]) === canonical(after[field])) continue;
    changes.push({ field, label, lines: describeChange(field, before, after) });
  }
  return changes;
}

const fields: [keyof Recipe, string][] = [
  ["schema_version", "Schema version"],
  ["name", "Name"],
  ["description", "Description"],
  ["source", "Source"],
  ["serves", "Serves"],
  ["times", "Times"],
  ["difficulty", "Difficulty"],
  ["meal_type", "Meal type"],
  ["cuisine", "Cuisine"],
  ["carbs", "Carbs"],
  ["carb_detail", "Carb detail"],
  ["proteins", "Proteins"],
  ["dietary", "Suitable for"],
  ["equipment", "Equipment"],
  ["storage", "Storage"],
  ["spice_level", "Spice level"],
  ["tags", "Tags"],
  ["ingredients", "Ingredients"],
  ["method", "Method"],
  ["variations", "Variations"],
  ["nutrition_per_serving", "Nutrition"],
  ["notes", "Notes"],
];

function describeChange(field: keyof Recipe, before: Recipe, after: Recipe): DiffLine[] {
  switch (field) {
    case "times":
      return timesLines(before, after);
    case "nutrition_per_serving":
      return nutritionLines(before.nutrition_per_serving, after.nutrition_per_serving);
    case "ingredients":
      return ingredientLines(before.ingredients, after.ingredients);
    case "method":
      return methodLines(before.method, after.method);
    case "source":
      return objectLines(before.source, after.source, { kind: "Kind", title: "Title", details: "Details", url: "Link" });
    case "storage":
      return objectLines(before.storage, after.storage, {
        freezable: "Freezable",
        good_for_leftovers: "Good for leftovers",
        notes: "Notes",
      });
    case "proteins":
      return listLines(before.proteins.map(proteinText), after.proteins.map(proteinText));
    case "variations":
      return variationLines(before.variations, after.variations);
    case "meal_type":
    case "carbs":
    case "dietary":
    case "equipment":
    case "tags":
      return listLines((before[field] as string[]).map(word), (after[field] as string[]).map(word));
    default:
      return [valueLine(undefined, before[field], after[field])];
  }
}

function timesLines(before: Recipe, after: Recipe): DiffLine[] {
  const lines: DiffLine[] = [];
  const parts = [
    ["prep_mins", "Prep"],
    ["cook_mins", "Cook"],
    ["wait_mins", "Waiting"],
  ] as const;
  for (const [key, label] of parts) {
    if (before.times[key] !== after.times[key]) {
      lines.push({ kind: "change", label, before: formatMinutes(before.times[key]), after: formatMinutes(after.times[key]) });
    }
  }
  const [was, now] = [totalMins(before.times), totalMins(after.times)];
  if (was !== now) lines.push({ kind: "change", label: "Total", before: formatMinutes(was), after: formatMinutes(now) });
  if (before.times.notes !== after.times.notes) lines.push(valueLine("Notes", before.times.notes, after.times.notes));
  return lines;
}

function nutritionLines(before: Recipe["nutrition_per_serving"], after: Recipe["nutrition_per_serving"]): DiffLine[] {
  const parts = [
    ["kcal", "Calories", " kcal"],
    ["protein_g", "Protein", "g"],
    ["carbs_g", "Carbs", "g"],
    ["sugars_g", "Sugars", "g"],
    ["fat_g", "Fat", "g"],
    ["saturates_g", "Saturates", "g"],
    ["fibre_g", "Fibre", "g"],
    ["salt_g", "Salt", "g"],
  ] as const;
  const lines: DiffLine[] = [];
  if (before.source !== after.source) lines.push({ kind: "change", label: "Source", before: word(before.source), after: word(after.source) });
  for (const [key, label, unit] of parts) {
    if (before[key] !== after[key]) lines.push({ kind: "change", label, before: `${before[key]}${unit}`, after: `${after[key]}${unit}` });
  }
  return lines;
}

/** Matched by name: added, removed, and amounts that changed. Anything else is "other details changed". */
function ingredientLines(before: Ingredient[], after: Ingredient[]): DiffLine[] {
  const lines: DiffLine[] = [];
  const remaining = [...before];
  let otherChanges = false;
  for (const ingredient of after) {
    const index = remaining.findIndex((b) => b.item.toLowerCase() === ingredient.item.toLowerCase());
    if (index === -1) {
      lines.push({ kind: "added", text: `${ingredient.item}, ${amount(ingredient)}` });
      continue;
    }
    const [match] = remaining.splice(index, 1);
    if (amount(match) !== amount(ingredient)) {
      lines.push({ kind: "change", label: ingredient.item, before: amount(match), after: amount(ingredient) });
    } else if (canonical(match) !== canonical(ingredient)) {
      otherChanges = true;
    }
  }
  for (const ingredient of remaining) lines.push({ kind: "removed", text: ingredient.item });
  // Same ingredients, other details or order changed.
  if (otherChanges || lines.length === 0) lines.push({ kind: "changed", label: "Other details" });
  return lines;
}

function methodLines(before: Recipe["method"], after: Recipe["method"]): DiffLine[] {
  if (before.length !== after.length) {
    return [{ kind: "change", before: steps(before.length), after: steps(after.length) }];
  }
  return after.flatMap((step, i): DiffLine[] =>
    canonical(step) === canonical(before[i]) ? [] : [{ kind: "changed", label: `Step ${i + 1}` }],
  );
}

function variationLines(before: Recipe["variations"], after: Recipe["variations"]): DiffLine[] {
  const lines = listLines(
    before.map((v) => v.name),
    after.map((v) => v.name),
  );
  for (const variation of after) {
    const was = before.find((v) => v.name === variation.name);
    if (was && canonical(was) !== canonical(variation)) lines.push({ kind: "changed", label: variation.name });
  }
  return lines;
}

function objectLines<T extends object>(before: T, after: T, labels: Record<string, string>): DiffLine[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])] as (keyof T)[];
  return keys
    .filter((key) => canonical(before[key]) !== canonical(after[key]))
    .map((key) => valueLine(labels[key as string] ?? String(key), before[key], after[key]));
}

/** Entries added and removed, compared as text. */
function listLines(before: string[], after: string[]): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const item of after) if (!before.includes(item)) lines.push({ kind: "added", text: item });
  for (const item of before) if (!after.includes(item)) lines.push({ kind: "removed", text: item });
  return lines.length > 0 ? lines : [{ kind: "changed", label: "Order" }];
}

/** before → after if both are short, otherwise just "changed". */
function valueLine(label: string | undefined, before: unknown, after: unknown): DiffLine {
  const [was, now] = [text(before), text(after)];
  if (was.length > 60 || now.length > 60) return label ? { kind: "changed", label } : { kind: "changed" };
  return label ? { kind: "change", label, before: was, after: now } : { kind: "change", before: was, after: now };
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "none";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return word(value);
  return String(value);
}

/** "middle-eastern" -> "Middle eastern"; other text as it is. */
function word(value: string): string {
  if (!/^[a-z0-9-]+$/.test(value)) return value;
  const spaced = value.replaceAll("-", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function amount(ingredient: Ingredient): string {
  if (ingredient.qty === null) return ingredient.unit ? `some ${ingredient.unit}` : "to taste";
  return ingredient.unit ? `${ingredient.qty} ${ingredient.unit}` : String(ingredient.qty);
}

function proteinText(protein: Recipe["proteins"][number]): string {
  return `${word(protein.item)} (${protein.category}${protein.detail ? `, ${protein.detail}` : ""})`;
}

function steps(n: number): string {
  return n === 1 ? "1 step" : `${n} steps`;
}

/** JSON with object keys sorted, so key order doesn't count as a change. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
