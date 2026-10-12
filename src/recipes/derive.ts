// Derived recipe values (handover section 5): fixed rules, no inference.
// Pure, so screens can use them too (scaling, nutrition, charts).
import type { DietaryFlag, Nutrition, Recipe } from "@/types/recipe";

/** The Meat / Fish / Veg browsing category. Not a dietary claim: see `dietary`. */
export type ProteinType = "meat" | "fish" | "meat-and-fish" | "vegetarian";

/** protein_type, with Vegan split out of vegetarian (decisions 2026-10-11, PP-145). */
export type BrowsingCategory = ProteinType | "vegan";

type Proteins = Recipe["proteins"];

/** prep + cook + wait. */
export function totalMins(times: Recipe["times"]): number {
  return times.prep_mins + times.cook_mins + times.wait_mins;
}

/** Meat and fish: meat-and-fish. Only one of them: that. Anything else, including none: vegetarian. */
export function proteinType(proteins: Proteins): ProteinType {
  const meat = proteins.some((p) => p.category === "meat");
  const fish = proteins.some((p) => p.category === "fish");
  if (meat && fish) return "meat-and-fish";
  if (meat) return "meat";
  if (fish) return "fish";
  return "vegetarian";
}

/** Every protein item (e.g. tuna, chicken), once each, in order. */
export function proteinItems(proteins: Proteins): string[] {
  return [...new Set(proteins.map((p) => p.item))];
}

/**
 * Vegetarian already, or a variation lists its proteins and none is meat or
 * fish. A variation without a `proteins` list keeps the main recipe's.
 */
export function hasVeggieOption(recipe: Pick<Recipe, "proteins" | "variations">): boolean {
  if (proteinType(recipe.proteins) === "vegetarian") return true;
  return recipe.variations.some((v) => v.proteins !== undefined && proteinType(v.proteins) === "vegetarian");
}

/** Vegan when protein_type is vegetarian and `dietary` says vegan. */
export function browsingCategory(type: ProteinType, dietary: readonly DietaryFlag[]): BrowsingCategory {
  return type === "vegetarian" && dietary.includes("vegan") ? "vegan" : type;
}

/** qty × target / serves. A null qty ("to taste") stays null. */
export function scaleQty(qty: number | null, serves: number, targetServings: number): number | null {
  return qty === null ? null : (qty * targetServings) / serves;
}

/** Per-person nutrition for a meal plan entry: per serving × portions per person. */
export function entryNutrition(perServing: Nutrition, portionsPerPerson: number): Nutrition {
  const times = (n: number) => n * portionsPerPerson;
  return {
    source: perServing.source,
    kcal: times(perServing.kcal),
    fat_g: times(perServing.fat_g),
    saturates_g: times(perServing.saturates_g),
    carbs_g: times(perServing.carbs_g),
    sugars_g: times(perServing.sugars_g),
    fibre_g: times(perServing.fibre_g),
    protein_g: times(perServing.protein_g),
    salt_g: times(perServing.salt_g),
  };
}

/** Energy from protein (×4), carbs (×4) and fat (×9), as percentages of their sum. All 0 if the sum is 0. */
export function macroEnergySplit(n: Pick<Nutrition, "protein_g" | "carbs_g" | "fat_g">) {
  const protein = n.protein_g * 4;
  const carbs = n.carbs_g * 4;
  const fat = n.fat_g * 9;
  const total = protein + carbs + fat;
  if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: (protein / total) * 100, carbs: (carbs / total) * 100, fat: (fat / total) * 100 };
}

/**
 * Every extracted column of the recipes table, from the recipe alone
 * (handover section 4). Re-running this is the whole backfill.
 */
export function deriveColumns(recipe: Recipe) {
  const n = recipe.nutrition_per_serving;
  return {
    slug: recipe.id,
    schemaVersion: recipe.schema_version,
    name: recipe.name,
    cuisine: recipe.cuisine,
    difficulty: recipe.difficulty,
    serves: recipe.serves,
    totalMins: totalMins(recipe.times),
    carbs: [...recipe.carbs] as string[],
    proteinType: proteinType(recipe.proteins),
    proteinItems: proteinItems(recipe.proteins),
    mealType: [...recipe.meal_type] as string[],
    dietary: [...recipe.dietary] as string[],
    spiceLevel: recipe.spice_level,
    hasVeggieOption: hasVeggieOption(recipe),
    kcal: n.kcal,
    fatG: n.fat_g,
    saturatesG: n.saturates_g,
    carbsG: n.carbs_g,
    sugarsG: n.sugars_g,
    fibreG: n.fibre_g,
    proteinG: n.protein_g,
    saltG: n.salt_g,
    nutritionSource: n.source,
    sourceKind: recipe.source.kind,
    sourceTitle: recipe.source.title,
  };
}

export type DerivedColumns = ReturnType<typeof deriveColumns>;
