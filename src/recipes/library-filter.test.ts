import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Recipe } from "@/types/recipe";
import { deriveColumns } from "./derive";
import {
  activeFilters,
  applyState,
  categoriesOf,
  countMatching,
  facets,
  matchedIngredient,
  noFilters,
  parseState,
  removalSuggestions,
  toSearch,
  type Filters,
  type LibraryRecipe,
  type LibraryState,
} from "./library-filter";

const example = (slug: string): Recipe =>
  JSON.parse(readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8"));

/** A library row as listRecipes returns it, from a recipe file. */
function row(recipe: Recipe, createdAt = "2026-10-01T00:00:00Z"): LibraryRecipe {
  const c = deriveColumns(recipe);
  return {
    id: `id-${c.slug}`,
    slug: c.slug,
    name: c.name,
    totalMins: c.totalMins,
    kcal: c.kcal,
    proteinG: c.proteinG,
    nutritionSource: c.nutritionSource,
    proteinType: c.proteinType,
    proteinItems: c.proteinItems,
    dietary: c.dietary,
    carbs: c.carbs,
    hasVeggieOption: c.hasVeggieOption,
    cuisine: c.cuisine,
    difficulty: c.difficulty,
    mealType: c.mealType,
    spiceLevel: c.spiceLevel,
    sourceKind: c.sourceKind,
    sourceTitle: c.sourceTitle,
    createdAt,
    equipment: recipe.equipment,
    freezable: recipe.storage.freezable,
    ingredients: recipe.ingredients.map((i) => ({ item: i.item, prep: i.prep ?? null })),
    favourite: false,
    rating: null,
    lastCooked: null,
  };
}

const tuna = example("lemony-tuna-tomato-caper-pasta");
const tofoo = example("char-siu-tofoo-noodles");
const variant = (base: Recipe, change: Partial<Recipe>): Recipe => ({ ...structuredClone(base), ...change });

const library: LibraryRecipe[] = [
  row(tuna, "2026-10-01T00:00:00Z"),
  row(tofoo, "2026-10-03T00:00:00Z"),
  row(
    variant(tuna, {
      id: "chicken-katsu",
      name: "Chicken katsu curry",
      proteins: [{ category: "meat", item: "chicken" }],
      variations: [],
      carbs: ["rice"],
      cuisine: "japanese",
      difficulty: "medium",
      spice_level: "mild",
      equipment: ["hob", "oven"],
      dietary: ["dairy-free"],
      meal_type: ["dinner"],
      source: { kind: "family", title: "Mum" },
      times: { prep_mins: 20, cook_mins: 40, wait_mins: 0 },
    }),
    "2026-10-02T00:00:00Z",
  ),
  row(
    variant(tuna, {
      id: "surf-and-turf",
      name: "surf and turf",
      proteins: [
        { category: "meat", item: "beef" },
        { category: "fish", item: "prawns" },
      ],
      variations: [],
      carbs: ["potato"],
      cuisine: "american",
      spice_level: "medium",
      equipment: ["grill"],
      dietary: ["gluten-free"],
      storage: { freezable: true, good_for_leftovers: false },
      times: { prep_mins: 10, cook_mins: 10, wait_mins: 0 },
    }),
  ),
  row(
    variant(tofoo, {
      id: "lentil-dal",
      name: "Lentil dal",
      proteins: [{ category: "vegetarian", item: "beans-pulses" }],
      dietary: ["vegetarian", "vegan", "gluten-free"],
      carbs: ["none"],
      cuisine: "indian",
      meal_type: ["lunch", "dinner"],
      equipment: [],
    }),
  ),
];

const state = (filters: Partial<Filters> = {}, q = "", sort: LibraryState["sort"] = "name"): LibraryState => ({
  filters: { ...noFilters(), ...filters },
  q,
  sort,
});
const names = (s: LibraryState) => applyState(library, s).map((r) => r.slug);

describe("the ticket's examples", () => {
  it('"Pasta" + "Fish" + "Tuna" finds the tuna pasta', () => {
    expect(names(state({ carbs: ["pasta"], category: ["fish"], items: ["fish:tuna"] }))).toEqual([tuna.id]);
  });

  it('"Veg" finds the Tofoo noodles (and the vegan dal)', () => {
    expect(names(state({ category: ["veg"] }))).toEqual([tofoo.id, "lentil-dal"]);
  });

  it('"has veggie option" finds both examples', () => {
    expect(names(state({ veggieOption: true }))).toEqual(expect.arrayContaining([tuna.id, tofoo.id]));
    expect(names(state({ veggieOption: true }))).not.toContain("chicken-katsu");
  });
});

describe("each filter", () => {
  it("Vegan: vegetarian recipes marked vegan; Veg includes them", () => {
    expect(names(state({ category: ["vegan"] }))).toEqual(["lentil-dal"]);
    expect(categoriesOf(library[4])).toEqual(["veg", "vegan"]);
  });

  it("meat & fish counts as both Meat and Fish", () => {
    expect(names(state({ category: ["meat"] }))).toEqual(["chicken-katsu", "surf-and-turf"]);
    expect(names(state({ category: ["fish"] }))).toEqual([tuna.id, "surf-and-turf"]);
  });

  it("type of meat or fish narrows only its own category", () => {
    expect(names(state({ category: ["meat", "fish"], items: ["fish:tuna"] }))).toEqual([
      "chicken-katsu",
      tuna.id,
      "surf-and-turf",
    ]);
    expect(names(state({ category: ["fish"], items: ["fish:prawns"] }))).toEqual(["surf-and-turf"]);
    // An item without its category ticked does nothing.
    expect(names(state({ items: ["fish:tuna"] }))).toHaveLength(5);
  });

  it("carbs, including no carbs", () => {
    expect(names(state({ carbs: ["rice", "potato"] }))).toEqual(["chicken-katsu", "surf-and-turf"]);
    expect(names(state({ carbs: ["none"] }))).toEqual(["lentil-dal"]);
  });

  it("max total time", () => {
    expect(names(state({ maxMins: 20 }))).toEqual(["surf-and-turf"]);
    expect(names(state({ maxMins: 45 }))).toEqual([tuna.id, "surf-and-turf"]);
  });

  it("meal type", () => {
    expect(names(state({ meal: ["lunch"] }))).toEqual(["lentil-dal"]);
  });

  it("cuisine", () => {
    expect(names(state({ cuisine: ["japanese", "indian"] }))).toEqual(["chicken-katsu", "lentil-dal"]);
  });

  it("source: by title, family grouped", () => {
    expect(names(state({ source: ["family"] }))).toEqual(["chicken-katsu"]);
    expect(names(state({ source: ["BBC Good Food"] }))).toEqual([tuna.id, "surf-and-turf"]);
  });

  it("suitable for: every ticked flag", () => {
    expect(names(state({ dietary: ["gluten-free"] }))).toEqual(["lentil-dal", "surf-and-turf"]);
    expect(names(state({ dietary: ["gluten-free", "vegan"] }))).toEqual(["lentil-dal"]);
  });

  it("cook with: nothing beyond the ticked equipment", () => {
    // The dal needs nothing, so it's always in.
    expect(names(state({ equipment: ["hob"] }))).toEqual([tofoo.id, tuna.id, "lentil-dal"]);
    expect(names(state({ equipment: ["hob", "oven"] }))).toEqual([tofoo.id, "chicken-katsu", tuna.id, "lentil-dal"]);
  });

  it("difficulty and spice", () => {
    expect(names(state({ difficulty: ["medium"] }))).toEqual(["chicken-katsu"]);
    expect(names(state({ spice: ["medium"] }))).toEqual(["surf-and-turf"]);
    expect(names(state({ spice: ["hot"] }))).toEqual([]);
  });

  it("freezable", () => {
    expect(names(state({ freezable: true }))).toEqual(["surf-and-turf"]);
  });

  it("sections combine with AND", () => {
    expect(names(state({ category: ["fish"], carbs: ["potato"] }))).toEqual(["surf-and-turf"]);
  });
});

describe("search", () => {
  it("matches names, ingredients and source titles, every word", () => {
    // The katsu and surf and turf were made from the tuna pasta, so they have its tinned tuna.
    expect(names(state({}, "TUNA"))).toEqual(["chicken-katsu", tuna.id, "surf-and-turf"]);
    expect(names(state({}, "lemony"))).toEqual([tuna.id]);
    expect(names(state({}, "good food"))).toEqual([tuna.id, "surf-and-turf"]);
    expect(names(state({}, "katsu mum"))).toEqual(["chicken-katsu"]);
    expect(names(state({}, "capers"))).toEqual(["chicken-katsu", tuna.id, "surf-and-turf"]);
    expect(names(state({}, "noodles capers"))).toEqual([]);
  });

  it("shows the ingredient only when the name doesn't match", () => {
    expect(matchedIngredient(library[0], ["tuna"])).toBeUndefined();
    expect(matchedIngredient(library[2], ["tuna"])).toBe("tuna in olive oil, drained");
    expect(matchedIngredient(library[0], [])).toBeUndefined();
  });

  it("combines with filters", () => {
    expect(names(state({ category: ["meat"] }, "capers"))).toEqual(["chicken-katsu", "surf-and-turf"]);
  });
});

describe("sort", () => {
  it("name A to Z ignoring case", () => {
    expect(names(state())).toEqual([tofoo.id, "chicken-katsu", tuna.id, "lentil-dal", "surf-and-turf"]);
  });

  it("recently added, quickest, fewest calories, most protein", () => {
    expect(names(state({}, "", "recent")).slice(0, 3)).toEqual([tofoo.id, "chicken-katsu", tuna.id]);
    expect(names(state({}, "", "quickest"))[0]).toBe("surf-and-turf");
    const kcal = applyState(library, state({}, "", "calories")).map((r) => r.kcal);
    expect(kcal).toEqual([...kcal].sort((a, b) => a - b));
    const protein = applyState(library, state({}, "", "protein")).map((r) => r.proteinG);
    expect(protein).toEqual([...protein].sort((a, b) => b - a));
  });
});

describe("the household's own data (PP-169)", () => {
  // Tofoo: favourite, 5 stars, cooked 2 Oct. Katsu: 3 stars, cooked 14 Sep.
  // Tuna: favourite, cooked 20 Sep, unrated. Surf and turf and dal: never cooked, unrated.
  const household: Record<string, Partial<LibraryRecipe>> = {
    [tofoo.id]: { favourite: true, rating: 5, lastCooked: "2026-10-02" },
    "chicken-katsu": { rating: 3, lastCooked: "2026-09-14" },
    [tuna.id]: { favourite: true, lastCooked: "2026-09-20" },
  };
  const mine = library.map((r) => ({ ...r, ...household[r.slug] }));
  const find = (s: LibraryState) => applyState(mine, s).map((r) => r.slug);

  it("Favourites only", () => {
    expect(find(state({ favourites: true }))).toEqual([tofoo.id, tuna.id]);
    expect(find(state({ favourites: true, category: ["fish"] }))).toEqual([tuna.id]);
    expect(facets(mine, state({ category: ["fish"] })).favourites).toBe(1);
    expect(activeFilters(state({ favourites: true }).filters).map((c) => c.label)).toEqual(["Favourites"]);
  });

  it("highest rated, unrated last A to Z", () => {
    expect(find(state({}, "", "rating"))).toEqual([tofoo.id, "chicken-katsu", tuna.id, "lentil-dal", "surf-and-turf"]);
  });

  it("not cooked for longest, never cooked first", () => {
    expect(find(state({}, "", "notCooked"))).toEqual(["lentil-dal", "surf-and-turf", "chicken-katsu", tuna.id, tofoo.id]);
  });

  it("cooked most recently, never cooked last", () => {
    expect(find(state({}, "", "cooked"))).toEqual([tofoo.id, tuna.id, "chicken-katsu", "lentil-dal", "surf-and-turf"]);
  });

  it("keeps Favourites only and the sorts in the URL", () => {
    const s = state({ favourites: true }, "", "notCooked");
    expect(toSearch(s)).toBe("?sort=notCooked&fav=1");
    expect(parseState(new URLSearchParams(toSearch(s)))).toEqual(s);
  });
});

describe("facets", () => {
  it("counts each option given the other filters", () => {
    const f = facets(library, state({ carbs: ["pasta"] }));
    expect(f.category).toEqual([
      { value: "meat", count: 0 },
      { value: "fish", count: 1 },
      { value: "veg", count: 0 },
      { value: "vegan", count: 0 },
    ]);
    // Carbs counts ignore the carbs filter itself.
    expect(f.carbs.find((c) => c.value === "rice")?.count).toBe(1);
  });

  it("lists items in the library for a category", () => {
    const f = facets(library, state({ category: ["fish"] }));
    expect(f.fishItems).toEqual([
      { value: "prawns", count: 1 },
      { value: "tuna", count: 1 },
    ]);
    expect(f.meatItems.map((i) => i.value)).toEqual(["beef", "chicken"]);
  });

  it("counts AND sections and switches with the option added", () => {
    const f = facets(library, state({ dietary: ["gluten-free"] }));
    expect(f.dietary.find((d) => d.value === "vegan")?.count).toBe(1);
    expect(f.freezable).toBe(1);
    expect(f.veggieOption).toBe(1);
  });

  it("only lists cuisines and sources in the library, most common first", () => {
    const f = facets(library, state());
    // One each, so A to Z.
    expect(f.cuisine.map((c) => c.value)).toEqual(["american", "chinese", "indian", "italian", "japanese"]);
    expect(f.source[0]).toEqual({ value: "BBC Good Food", count: 2 });
    expect(f.source.map((s) => s.value)).toContain("family");
  });
});

describe("the URL", () => {
  it("round-trips a state", () => {
    const s = state(
      {
        category: ["fish"],
        items: ["fish:tuna"],
        carbs: ["pasta"],
        maxMins: 45,
        source: ["BBC Good Food", "family"],
        veggieOption: true,
        freezable: true,
      },
      "lemon caper",
      "quickest",
    );
    const search = toSearch(s);
    expect(parseState(new URLSearchParams(search))).toEqual(s);
  });

  it("is empty for the defaults", () => {
    expect(toSearch(state())).toBe("");
  });

  it("ignores values it doesn't know", () => {
    const parsed = parseState(new URLSearchParams("cat=seafood&cat=fish&time=17&sort=random&diet=keto"));
    expect(parsed).toEqual(state({ category: ["fish"] }));
  });
});

describe("applied filters and suggestions", () => {
  it("collapses a category and its items into one chip", () => {
    const chips = activeFilters({ ...noFilters(), category: ["fish"], items: ["fish:tuna"], carbs: ["pasta"], maxMins: 45 });
    expect(chips.map((c) => c.label)).toEqual(["Fish: Tuna", "Pasta", "Up to 45 min"]);
    expect(chips[0].remove({ ...noFilters(), category: ["fish"], items: ["fish:tuna"] })).toEqual(noFilters());
  });

  it("suggests the filters to remove, with what each brings back", () => {
    const s = state({ category: ["vegan"], carbs: ["pastry"], maxMins: 20 });
    expect(countMatching(library, s.filters, "")).toBe(0);
    expect(removalSuggestions(library, s).map((x) => [x.filter.label, x.count])).toEqual([]);
    const t = state({ category: ["vegan"], maxMins: 20 });
    expect(removalSuggestions(library, t).map((x) => [x.filter.label, x.count])).toEqual([
      ["Vegan", 1],
      ["Up to 20 min", 1],
    ]);
  });
});
