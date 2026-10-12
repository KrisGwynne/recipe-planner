// The library's search, filters and sort (PP-167, designs/src/library.html C
// to H). Pure: the whole household library is small, so it's filtered,
// counted and sorted here, in the browser and for the first server render
// alike (Kris, 2026-10-12). The state lives in the URL.
import type { DietaryFlag } from "@/types/recipe";
import { browsingCategory, type ProteinType } from "./derive";
import type { RecipeListRow } from "./summary";

/** A recipe as listRecipes returns it: card fields plus what filters and search read. */
export type LibraryRecipe = RecipeListRow & {
  cuisine: string;
  difficulty: string;
  mealType: string[];
  spiceLevel: string;
  sourceKind: string;
  sourceTitle: string;
  createdAt: Date | string;
  equipment: string[];
  freezable: boolean | null;
  ingredients: { item: string; prep: string | null }[];
};

export type Category = "meat" | "fish" | "veg" | "vegan";
export type SortKey = "name" | "recent" | "quickest" | "calories" | "protein";

export type Filters = {
  category: Category[];
  /** "fish:tuna", "meat:chicken": narrows its own category only. */
  items: string[];
  veggieOption: boolean;
  carbs: string[];
  maxMins: number | null;
  meal: string[];
  cuisine: string[];
  /** Source titles, or "family" for every family recipe. */
  source: string[];
  dietary: string[];
  equipment: string[];
  difficulty: string[];
  spice: string[];
  freezable: boolean;
};

export type LibraryState = { filters: Filters; q: string; sort: SortKey };

export const CATEGORIES: Category[] = ["meat", "fish", "veg", "vegan"];
export const CARBS = ["pasta", "rice", "noodles", "potato", "bread", "grains", "pastry", "none"];
export const TIMES = [20, 30, 45, 60];
export const MEALS = ["breakfast", "lunch", "dinner", "side", "snack", "dessert", "baking", "drink"];
export const DIETARY = ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"];
export const EQUIPMENT = [
  "hob",
  "oven",
  "grill",
  "microwave",
  "air-fryer",
  "slow-cooker",
  "pressure-cooker",
  "bbq",
  "food-processor",
  "blender",
  "stand-mixer",
];
export const DIFFICULTIES = ["easy", "medium", "hard"];
export const SPICE = ["none", "mild", "medium", "hot"];
export const MEAT_ITEMS = ["chicken", "turkey", "duck", "beef", "pork", "lamb", "game", "other"];
export const FISH_ITEMS = ["salmon", "tuna", "white-fish", "mackerel", "smoked-fish", "prawns", "mussels", "squid", "other"];

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name, A to Z" },
  { key: "recent", label: "Recently added" },
  { key: "quickest", label: "Quickest first" },
  { key: "calories", label: "Fewest calories" },
  { key: "protein", label: "Most protein" },
];

export const noFilters = (): Filters => ({
  category: [],
  items: [],
  veggieOption: false,
  carbs: [],
  maxMins: null,
  meal: [],
  cuisine: [],
  source: [],
  dietary: [],
  equipment: [],
  difficulty: [],
  spice: [],
  freezable: false,
});

// --- The URL ---

type Params = { getAll(name: string): string[]; get(name: string): string | null };

/** Reads the state from the URL, ignoring anything it doesn't know. */
export function parseState(params: Params): LibraryState {
  const known = (name: string, allowed: readonly string[]) => [...new Set(params.getAll(name).filter((v) => allowed.includes(v)))];
  const any = (name: string) => [...new Set(params.getAll(name).filter((v) => v.length > 0 && v.length <= 200))];
  const time = Number(params.get("time"));
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").slice(0, 200),
    sort: SORTS.some((s) => s.key === sort) ? (sort as SortKey) : "name",
    filters: {
      category: known("cat", CATEGORIES) as Category[],
      items: known("item", [...MEAT_ITEMS.map((i) => `meat:${i}`), ...FISH_ITEMS.map((i) => `fish:${i}`)]),
      veggieOption: params.get("veggie") === "1",
      carbs: known("carb", CARBS),
      maxMins: TIMES.includes(time) ? time : null,
      meal: known("meal", MEALS),
      cuisine: any("cuisine"),
      source: any("source"),
      dietary: known("diet", DIETARY),
      equipment: known("cook", EQUIPMENT),
      difficulty: known("difficulty", DIFFICULTIES),
      spice: known("spice", SPICE),
      freezable: params.get("freezable") === "1",
    },
  };
}

/** The query string for a state ("" for the defaults). */
export function toSearch({ filters: f, q, sort }: LibraryState): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q);
  if (sort !== "name") params.set("sort", sort);
  const lists: [string, string[]][] = [
    ["cat", f.category],
    ["item", f.items],
    ["carb", f.carbs],
    ["meal", f.meal],
    ["cuisine", f.cuisine],
    ["source", f.source],
    ["diet", f.dietary],
    ["cook", f.equipment],
    ["difficulty", f.difficulty],
    ["spice", f.spice],
  ];
  for (const [name, values] of lists) for (const value of values) params.append(name, value);
  if (f.veggieOption) params.set("veggie", "1");
  if (f.maxMins !== null) params.set("time", String(f.maxMins));
  if (f.freezable) params.set("freezable", "1");
  const text = params.toString();
  return text ? `?${text}` : "";
}

// --- Matching ---

/** Where a recipe sits for the Meat / Fish / Veg / Vegan filter. Meat & fish counts as both. */
export function categoriesOf(recipe: LibraryRecipe): Category[] {
  const browsing = browsingCategory(recipe.proteinType as ProteinType, recipe.dietary as DietaryFlag[]);
  if (browsing === "meat-and-fish") return ["meat", "fish"];
  if (browsing === "vegan") return ["veg", "vegan"];
  if (browsing === "vegetarian") return ["veg"];
  return [browsing];
}

/** The Source filter's group: the title, or "family" for all family recipes. */
export function sourceGroup(recipe: LibraryRecipe): string {
  return recipe.sourceKind === "family" ? "family" : recipe.sourceTitle;
}

type Section =
  | "category"
  | "veggieOption"
  | "carbs"
  | "maxMins"
  | "meal"
  | "cuisine"
  | "source"
  | "dietary"
  | "equipment"
  | "difficulty"
  | "spice"
  | "freezable";

const anyOf = (selected: string[], values: string[]) => selected.length === 0 || selected.some((v) => values.includes(v));

/** Whether a recipe passes one section's filter. Options within a section are OR, except where noted. */
function passes(section: Section, recipe: LibraryRecipe, f: Filters): boolean {
  switch (section) {
    case "category": {
      if (f.category.length === 0) return true;
      const mine = categoriesOf(recipe);
      return f.category.some((c) => {
        if (!mine.includes(c)) return false;
        // Ticked items narrow their own category: Meat + "Fish: Tuna" is any meat, or tuna.
        const items = f.items.filter((i) => i.startsWith(`${c}:`)).map((i) => i.slice(c.length + 1));
        return items.length === 0 || items.some((i) => recipe.proteinItems.includes(i));
      });
    }
    case "veggieOption":
      return !f.veggieOption || recipe.hasVeggieOption;
    case "carbs":
      return anyOf(f.carbs, recipe.carbs);
    case "maxMins":
      return f.maxMins === null || recipe.totalMins <= f.maxMins;
    case "meal":
      return anyOf(f.meal, recipe.mealType);
    case "cuisine":
      return anyOf(f.cuisine, [recipe.cuisine]);
    case "source":
      return anyOf(f.source, [sourceGroup(recipe)]);
    case "dietary":
      // Strict: every ticked flag.
      return f.dietary.every((d) => recipe.dietary.includes(d));
    case "equipment":
      // "Cook with": needs nothing beyond what's ticked.
      return f.equipment.length === 0 || recipe.equipment.every((e) => f.equipment.includes(e));
    case "difficulty":
      return anyOf(f.difficulty, [recipe.difficulty]);
    case "spice":
      return anyOf(f.spice, [recipe.spiceLevel]);
    case "freezable":
      return !f.freezable || recipe.freezable === true;
  }
}

const SECTIONS: Section[] = [
  "category",
  "veggieOption",
  "carbs",
  "maxMins",
  "meal",
  "cuisine",
  "source",
  "dietary",
  "equipment",
  "difficulty",
  "spice",
  "freezable",
];

/** Search words, lower case. */
export function searchWords(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every word appears in the name, an ingredient or the source title. */
export function matchesSearch(recipe: LibraryRecipe, words: string[]): boolean {
  if (words.length === 0) return true;
  const haystack = [recipe.name, recipe.sourceTitle, ...recipe.ingredients.map((i) => i.item)].join("\n").toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** The ingredient to show when the name doesn't match the search but an ingredient does (design C). */
export function matchedIngredient(recipe: LibraryRecipe, words: string[]): string | undefined {
  if (words.length === 0) return undefined;
  const name = recipe.name.toLowerCase();
  if (words.some((w) => name.includes(w))) return undefined;
  const hit = recipe.ingredients.find((i) => words.some((w) => i.item.toLowerCase().includes(w)));
  return hit ? (hit.prep ? `${hit.item}, ${hit.prep}` : hit.item) : undefined;
}

function matchesAll(recipe: LibraryRecipe, f: Filters, words: string[], except?: Section): boolean {
  return matchesSearch(recipe, words) && SECTIONS.every((s) => s === except || passes(s, recipe, f));
}

/** The recipes the state finds, sorted. */
export function applyState(recipes: LibraryRecipe[], state: LibraryState): LibraryRecipe[] {
  const words = searchWords(state.q);
  return sortRecipes(
    recipes.filter((r) => matchesAll(r, state.filters, words)),
    state.sort,
  );
}

export function countMatching(recipes: LibraryRecipe[], filters: Filters, q: string): number {
  const words = searchWords(q);
  return recipes.filter((r) => matchesAll(r, filters, words)).length;
}

// --- Sorting ---

const byName = (a: LibraryRecipe, b: LibraryRecipe) =>
  a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" });

export function sortRecipes(recipes: LibraryRecipe[], sort: SortKey): LibraryRecipe[] {
  const time = (r: LibraryRecipe) => new Date(r.createdAt).getTime();
  const compare: Record<SortKey, (a: LibraryRecipe, b: LibraryRecipe) => number> = {
    name: byName,
    recent: (a, b) => time(b) - time(a) || byName(a, b),
    quickest: (a, b) => a.totalMins - b.totalMins || byName(a, b),
    calories: (a, b) => a.kcal - b.kcal || byName(a, b),
    protein: (a, b) => b.proteinG - a.proteinG || byName(a, b),
  };
  return [...recipes].sort(compare[sort]);
}

// --- Counts (faceted: what each option would find, given the other filters) ---

export type Option = { value: string; count: number };

/** OR sections: each option on its own, with every other section's filter applied. */
function countEach(
  recipes: LibraryRecipe[],
  f: Filters,
  words: string[],
  section: Section,
  values: string[],
  has: (r: LibraryRecipe, value: string) => boolean,
): Option[] {
  const base = recipes.filter((r) => matchesAll(r, f, words, section));
  return values.map((value) => ({ value, count: base.filter((r) => has(r, value)).length }));
}

/** AND-like sections and switches: the current filters plus this option. */
function countWith(recipes: LibraryRecipe[], f: Filters, words: string[], values: string[], add: (value: string) => Filters): Option[] {
  return values.map((value) => ({ value, count: countMatching(recipes, add(value), words.join(" ")) }));
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list : [...list, value]);

/** Most common first; ties A to Z. */
const byCount = (options: Option[]) =>
  [...options].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "en-GB"));

export type Facets = {
  category: Option[];
  meatItems: Option[];
  fishItems: Option[];
  veggieOption: number;
  carbs: Option[];
  time: Option[];
  meal: Option[];
  cuisine: Option[];
  source: Option[];
  dietary: Option[];
  equipment: Option[];
  difficulty: Option[];
  spice: Option[];
  freezable: number;
};

export function facets(recipes: LibraryRecipe[], state: LibraryState): Facets {
  const { filters: f } = state;
  const words = searchWords(state.q);
  const present = (pick: (r: LibraryRecipe) => string[]) => [...new Set(recipes.flatMap(pick))];

  // Items for a category: on their own within that category, with every other filter applied.
  const itemOptions = (category: "meat" | "fish", all: string[]) => {
    const base = recipes.filter(
      (r) => matchesAll(r, f, words, "category") && categoriesOf(r).includes(category),
    );
    const inLibrary = all.filter((i) => base.some((r) => r.proteinItems.includes(i)) || f.items.includes(`${category}:${i}`));
    return byCount(inLibrary.map((i) => ({ value: i, count: base.filter((r) => r.proteinItems.includes(i)).length })));
  };

  return {
    category: countEach(recipes, f, words, "category", CATEGORIES, (r, c) => categoriesOf(r).includes(c as Category)),
    meatItems: itemOptions("meat", MEAT_ITEMS),
    fishItems: itemOptions("fish", FISH_ITEMS),
    veggieOption: countMatching(recipes, { ...f, veggieOption: true }, state.q),
    carbs: countEach(recipes, f, words, "carbs", CARBS, (r, c) => r.carbs.includes(c)),
    time: countEach(recipes, f, words, "maxMins", TIMES.map(String), (r, t) => r.totalMins <= Number(t)),
    meal: byCount(countEach(recipes, f, words, "meal", MEALS, (r, m) => r.mealType.includes(m))),
    cuisine: byCount(
      countEach(recipes, f, words, "cuisine", [...new Set([...present((r) => [r.cuisine]), ...f.cuisine])], (r, c) => r.cuisine === c),
    ),
    source: byCount(
      countEach(recipes, f, words, "source", [...new Set([...present((r) => [sourceGroup(r)]), ...f.source])], (r, s) => sourceGroup(r) === s),
    ),
    dietary: countWith(recipes, f, words, DIETARY, (d) => ({ ...f, dietary: toggle(f.dietary, d) })),
    equipment: byCount(countWith(recipes, f, words, EQUIPMENT, (e) => ({ ...f, equipment: toggle(f.equipment, e) }))),
    difficulty: countEach(recipes, f, words, "difficulty", DIFFICULTIES, (r, d) => r.difficulty === d),
    spice: countEach(recipes, f, words, "spice", SPICE, (r, s) => r.spiceLevel === s),
    freezable: countMatching(recipes, { ...f, freezable: true }, state.q),
  };
}

// --- Applied filters as chips (design F), and what removing each would bring back (H) ---

export type ActiveFilter = { key: string; label: string; remove: (f: Filters) => Filters };

const without = <T extends string>(list: T[], value: T): T[] => list.filter((v) => v !== value);

export function activeFilters(f: Filters): ActiveFilter[] {
  const chips: ActiveFilter[] = [];
  for (const c of f.category) {
    const items = f.items.filter((i) => i.startsWith(`${c}:`));
    const label = items.length > 0 ? `${labels.category[c]}: ${items.map((i) => itemLabel(i.slice(c.length + 1))).join(", ")}` : labels.category[c];
    chips.push({
      key: `cat:${c}`,
      label,
      remove: (x) => ({ ...x, category: without(x.category, c), items: x.items.filter((i) => !i.startsWith(`${c}:`)) }),
    });
  }
  if (f.veggieOption) chips.push({ key: "veggie", label: "Has a veggie option", remove: (x) => ({ ...x, veggieOption: false }) });
  for (const c of f.carbs) chips.push({ key: `carb:${c}`, label: carbLabel(c), remove: (x) => ({ ...x, carbs: without(x.carbs, c) }) });
  if (f.maxMins !== null) chips.push({ key: "time", label: `Up to ${timeLabel(f.maxMins, true)}`, remove: (x) => ({ ...x, maxMins: null }) });
  for (const m of f.meal) chips.push({ key: `meal:${m}`, label: word(m), remove: (x) => ({ ...x, meal: without(x.meal, m) }) });
  for (const c of f.cuisine) chips.push({ key: `cuisine:${c}`, label: word(c), remove: (x) => ({ ...x, cuisine: without(x.cuisine, c) }) });
  for (const s of f.source) chips.push({ key: `source:${s}`, label: sourceLabel(s), remove: (x) => ({ ...x, source: without(x.source, s) }) });
  for (const d of f.dietary) chips.push({ key: `diet:${d}`, label: word(d), remove: (x) => ({ ...x, dietary: without(x.dietary, d) }) });
  if (f.equipment.length > 0) {
    chips.push({ key: "cook", label: `Cook with: ${f.equipment.map(word).join(", ")}`, remove: (x) => ({ ...x, equipment: [] }) });
  }
  for (const d of f.difficulty) chips.push({ key: `difficulty:${d}`, label: word(d), remove: (x) => ({ ...x, difficulty: without(x.difficulty, d) }) });
  for (const s of f.spice) chips.push({ key: `spice:${s}`, label: s === "none" ? "Not spicy" : `${word(s)} spice`, remove: (x) => ({ ...x, spice: without(x.spice, s) }) });
  if (f.freezable) chips.push({ key: "freezable", label: "Freezable", remove: (x) => ({ ...x, freezable: false }) });
  return chips;
}

/** For "Nothing matches": each applied filter whose removal would find something, best first. */
export function removalSuggestions(recipes: LibraryRecipe[], state: LibraryState): { filter: ActiveFilter; count: number }[] {
  return activeFilters(state.filters)
    .map((filter) => ({ filter, count: countMatching(recipes, filter.remove(state.filters), state.q) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

// --- Labels ---

export const labels = {
  category: { meat: "Meat", fish: "Fish", veg: "Veg", vegan: "Vegan" } as Record<Category, string>,
};

/** "middle-eastern" -> "Middle eastern". */
export function word(value: string): string {
  const spaced = value.replaceAll("-", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function itemLabel(item: string): string {
  return word(item);
}

export function carbLabel(carb: string): string {
  return carb === "none" ? "No carbs" : word(carb);
}

export function sourceLabel(group: string): string {
  return group === "family" ? "Family" : group;
}

/** "20m" / "1h" for the control; "45 min" / "1 hr" in chips. */
export function timeLabel(mins: number, long = false): string {
  if (long) return mins >= 60 ? `${mins / 60} hr` : `${mins} min`;
  return mins >= 60 ? `${mins / 60}h` : `${mins}m`;
}
