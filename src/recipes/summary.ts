// What the library's cards and list rows show for a recipe (PP-166), from the
// columns listRecipes returns. Pure, so it's tested without a database.
import { categoryOf } from "@/components/ui/badge";
import type { RecipeSummary } from "@/components/ui/recipe-card";
import type { DietaryFlag } from "@/types/recipe";
import { browsingCategory, type ProteinType } from "./derive";

export type RecipeListRow = {
  slug: string;
  name: string;
  totalMins: number;
  kcal: number;
  proteinG: number;
  nutritionSource: "printed" | "estimated";
  proteinType: ProteinType;
  proteinItems: string[];
  dietary: string[];
  carbs: string[];
  hasVeggieOption: boolean;
};

// Meat and fish items shown after the category ("Fish · Tuna"). Vegetarian
// items (tofu, egg...) and "other" aren't shown.
const meatAndFishItems: Record<string, string> = {
  chicken: "chicken",
  turkey: "turkey",
  duck: "duck",
  beef: "beef",
  pork: "pork",
  lamb: "lamb",
  game: "game",
  salmon: "salmon",
  tuna: "tuna",
  "white-fish": "white fish",
  mackerel: "mackerel",
  "smoked-fish": "smoked fish",
  prawns: "prawns",
  mussels: "mussels",
  squid: "squid",
};

/** The card or row for a recipe in the list. Links to /recipes/<slug>. */
export function toRecipeSummary(row: RecipeListRow): RecipeSummary {
  const category = categoryOf(browsingCategory(row.proteinType, row.dietary as DietaryFlag[]));
  const showsItems = category === "meat" || category === "fish" || category === "meat-and-fish";
  return {
    name: row.name,
    href: `/recipes/${row.slug}`,
    totalMins: row.totalMins,
    kcal: Math.round(row.kcal),
    proteinG: Math.round(row.proteinG),
    nutritionSource: row.nutritionSource,
    category,
    categoryDetail: showsItems ? itemsDetail(row.proteinItems) : undefined,
    carbs: row.carbs.filter((carb) => carb !== "none").map(capitalise),
    // Vegetarian and vegan recipes have a veggie option by definition; only say it for meat and fish.
    veggieOption: showsItems && row.hasVeggieOption,
  };
}

/** "Chicken, pork", or undefined if there's nothing to name. */
function itemsDetail(items: string[]): string | undefined {
  const labels = items.flatMap((item) => (item in meatAndFishItems ? [meatAndFishItems[item]] : []));
  return labels.length > 0 ? capitalise(labels.join(", ")) : undefined;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
