import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAST_KEY } from "@/compare/compare";
import type { LibraryRecipe } from "@/recipes/library-filter";
import type { Recipe } from "@/types/recipe";

const mocks = vi.hoisted(() => ({
  requireHousehold: vi.fn(),
  getRecipesBySlugs: vi.fn(),
  listRecipes: vi.fn(),
  router: { back: vi.fn(), push: vi.fn(), replace: vi.fn() },
}));
vi.mock("@/data", () => ({
  requireHousehold: mocks.requireHousehold,
  getRecipesBySlugs: mocks.getRecipesBySlugs,
  listRecipes: mocks.listRecipes,
}));
// Next keeps useSearchParams in step with history.replaceState; this does the same in jsdom.
vi.mock("next/navigation", () => {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      original(...args);
      notify();
    };
  }
  const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
  return {
    usePathname: () => window.location.pathname,
    useRouter: () => mocks.router,
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});

const { default: ComparePage } = await import("./page");
const { default: ChoosePage } = await import("./choose/page");

const example = (file: string): Recipe => JSON.parse(readFileSync(resolve("examples", `${file}.json`), "utf8"));
const tuna = example("lemony-tuna-tomato-caper-pasta");
const charSiu = example("char-siu-tofoo-noodles");
const rows = [tuna, charSiu].map((recipe) => ({ id: `id-${recipe.id}`, slug: recipe.id, data: recipe }));

const libraryRow = (recipe: Recipe, extra: Partial<LibraryRecipe> = {}): LibraryRecipe => ({
  id: `id-${recipe.id}`,
  slug: recipe.id,
  name: recipe.name,
  totalMins: 35,
  kcal: recipe.nutrition_per_serving.kcal,
  proteinG: recipe.nutrition_per_serving.protein_g,
  nutritionSource: recipe.nutrition_per_serving.source,
  proteinType: "fish",
  proteinItems: [],
  dietary: recipe.dietary,
  carbs: recipe.carbs,
  hasVeggieOption: false,
  cuisine: recipe.cuisine,
  difficulty: recipe.difficulty,
  mealType: ["dinner"],
  spiceLevel: recipe.spice_level,
  sourceKind: "book",
  sourceTitle: "A book",
  createdAt: "2026-10-01T00:00:00Z",
  equipment: [],
  freezable: null,
  ingredients: [],
  favourite: false,
  rating: null,
  lastCooked: null,
  ...extra,
});
const library = [
  libraryRow(charSiu),
  libraryRow(tuna),
  ...["a", "b", "c"].map((n) => libraryRow({ ...tuna, id: `recipe-${n}`, name: `Recipe ${n.toUpperCase()}` })),
];

const ctx = { householdId: "h1" };
const page = (query: Record<string, string | string[]>) => ComparePage({ searchParams: Promise.resolve(query) });
const both = { r: [tuna.id, charSiu.id] };

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/compare");
  mocks.requireHousehold.mockResolvedValue({ ctx });
  mocks.getRecipesBySlugs.mockImplementation(async (_ctx, slugs: string[]) => rows.filter((r) => slugs.includes(r.slug)));
  mocks.listRecipes.mockResolvedValue(library);
});
afterEach(() => vi.clearAllMocks());

describe("comparing the two examples (design C to E)", () => {
  it("looks the recipes up within the household, in the order chosen", async () => {
    render(await page({ r: [charSiu.id, tuna.id] }));
    expect(mocks.getRecipesBySlugs).toHaveBeenCalledWith(ctx, [charSiu.id, tuna.id]);
    const chosen = within(screen.getByRole("list", { name: "Recipes being compared" }));
    expect(chosen.getAllByRole("link", { name: /^(Char siu|Lemony)/ }).map((l) => l.textContent)).toEqual([charSiu.name, tuna.name]);
  });

  it("shows each recipe's source of nutrition, and the ~ on every estimated number", async () => {
    render(await page(both));
    const chosen = within(screen.getByRole("list", { name: "Recipes being compared" }));
    expect(chosen.getByText("Printed")).toBeInTheDocument();
    expect(chosen.getByText("~ Estimated")).toBeInTheDocument();

    const calories = within(screen.getByRole("figure", { name: /Calories/ }));
    expect(calories.getByText("672")).toBeInTheDocument();
    expect(calories.getByText("~825")).toBeInTheDocument();
    const protein = within(screen.getByRole("figure", { name: /Protein/ }));
    expect(protein.getByText("29g")).toBeInTheDocument();
    expect(protein.getByText("~31g")).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: /Carbs/ })).toHaveTextContent("~92g");
    expect(screen.getByRole("figure", { name: /Fat/ })).toHaveTextContent("~34g");
  });

  it("draws estimated bars dashed, scaled to the largest value", async () => {
    render(await page(both));
    const bars = within(screen.getByRole("figure", { name: /Calories/ }))
      .getAllByRole("listitem")
      .map((item) => item.querySelector("span[aria-hidden]") as HTMLElement);
    expect(bars[0]).toHaveClass("bg-ink");
    expect(bars[0].style.width).toBe("63.5%");
    expect(bars[1]).toHaveClass("border-dashed");
    expect(bars[1].style.width).toBe("78%");
  });

  it("draws the bars in one after another, unless reduced motion is on (PP-184)", async () => {
    render(await page(both));
    const bars = within(screen.getByRole("figure", { name: /Protein/ }))
      .getAllByRole("listitem")
      .map((item) => item.querySelector("span[aria-hidden]") as HTMLElement);
    expect(bars[0]).toHaveClass("motion-safe:animate-bar-in");
    expect(bars.map((bar) => bar.style.animationDelay)).toEqual(["0ms", "80ms"]);
  });

  it("shows where the calories come from, with the ~ for estimates", async () => {
    render(await page(both));
    const split = screen.getAllByRole("region", { name: "Where the calories come from" })[0];
    expect(split).toHaveTextContent("Protein 18%");
    expect(split).toHaveTextContent("Protein ~16%");
    expect(split).toHaveTextContent("Fat ~38%");
  });

  it("puts everything else in the table", async () => {
    render(await page(both));
    const table = within(screen.getByRole("table"));
    const cells = (label: string) =>
      within(table.getByRole("rowheader", { name: label }).closest("tr")!).getAllByRole("cell").map((c) => c.textContent);
    expect(cells("Time")).toEqual(["35 min5 prep · 30 cook", "55 min15 prep · 10 cook · 30 wait"]);
    expect(cells("Serves")).toEqual(["4", "2"]);
    expect(cells("Carb type")).toEqual(["Pasta", "Noodles"]);
    expect(cells("Protein type")).toEqual(["FishTuna", "VegTofu"]);
    expect(cells("Protein")).toEqual(["29g", "~31g"]);
    expect(cells("Dietary")).toEqual(["Nut-free", "VegetarianDairy-freeNut-free"]);
    expect(cells("Nutrition")).toEqual(["Printed", "~ Estimated"]);
    expect(cells("Salt")).toEqual(["1.5g", "~5.5g"]);
    expect(cells("Sugars")).toEqual(["12g", "~34g"]);
  });

  it("removes a recipe through the address, and offers Add until there are four", async () => {
    render(await page(both));
    expect(screen.getByRole("link", { name: `Remove ${tuna.name} from the comparison` })).toHaveAttribute(
      "href",
      `/compare?r=${charSiu.id}`,
    );
    expect(screen.getByRole("link", { name: "Add a recipe" })).toHaveAttribute(
      "href",
      `/compare/choose?r=${tuna.id}&r=${charSiu.id}`,
    );
  });

  it("remembers the comparison on this device", async () => {
    render(await page(both));
    expect(JSON.parse(localStorage.getItem(LAST_KEY)!)).toEqual([tuna.id, charSiu.id]);
  });
});

describe("four recipes (design F)", () => {
  it("says four is the most instead of offering Add", async () => {
    const four = ["a", "b", "c", "d"].map((n) => ({ id: n, slug: n, data: { ...tuna, id: n, name: `Recipe ${n}` } }));
    mocks.getRecipesBySlugs.mockResolvedValue(four);
    render(await page({ r: ["a", "b", "c", "d"] }));
    expect(screen.getByText("4 is the most. Remove one to add another.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add a recipe" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("figure", { name: /Calories/ })).getAllByRole("listitem")).toHaveLength(4);
  });
});

describe("edge cases (design A, H)", () => {
  it("leaves out a recipe that isn't in the household, and with one left asks for another", async () => {
    render(await page({ r: [tuna.id, "someone-elses-recipe"] }));
    expect(screen.getByText("Add at least one more recipe to compare.")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(LAST_KEY)!)).toEqual([tuna.id]);
  });

  it("asks for an import when the library has fewer than two recipes", async () => {
    mocks.listRecipes.mockResolvedValue([libraryRow(tuna)]);
    render(await page({ r: "" }));
    expect(screen.getByRole("heading", { name: "Import at least two recipes to compare them" })).toBeInTheDocument();
    expect(screen.getByText("You have 1 so far.")).toBeInTheDocument();
  });

  it("starts empty when nothing was chosen, even with a comparison remembered", async () => {
    localStorage.setItem(LAST_KEY, JSON.stringify([tuna.id, charSiu.id]));
    render(await page({ r: "" }));
    expect(screen.getByRole("link", { name: "Choose recipes" })).toHaveAttribute("href", "/compare/choose");
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(LAST_KEY)!)).toEqual([]);
  });

  it("the bare tab goes back to the last comparison", async () => {
    localStorage.setItem(LAST_KEY, JSON.stringify([tuna.id, charSiu.id]));
    render(await page({}));
    expect(mocks.router.replace).toHaveBeenCalledWith(`/compare?r=${tuna.id}&r=${charSiu.id}`);
    expect(screen.queryByRole("link", { name: "Choose recipes" })).not.toBeInTheDocument();
  });

  it("the bare tab shows the empty page when nothing is remembered, or storage fails", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(await page({}));
    expect(await screen.findByRole("heading", { name: "See recipes side by side" })).toBeInTheDocument();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    getItem.mockRestore();
  });
});

describe("choosing recipes (design B, I)", () => {
  const choose = async (query: Record<string, string | string[]> = {}) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) for (const value of [v].flat()) search.append(k, value);
    window.history.replaceState(null, "", `/compare/choose?${search}`);
    render(await ChoosePage({ searchParams: Promise.resolve(query) }));
  };
  const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

  it("starts with the recipe it was opened from ticked, and needs two", async () => {
    await choose({ r: charSiu.id });
    expect(row(charSiu.name)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("1 chosen · up to 4");
    expect(screen.getByRole("button", { name: "Choose at least 2" })).toBeDisabled();
    fireEvent.click(row(tuna.name));
    fireEvent.click(screen.getByRole("button", { name: "Compare 2 recipes" }));
    expect(mocks.router.replace).toHaveBeenCalledWith(`/compare?r=${charSiu.id}&r=${tuna.id}`);
  });

  it("ignores slugs that aren't in the household", async () => {
    await choose({ r: ["not-ours", tuna.id] });
    expect(screen.getByRole("status")).toHaveTextContent("1 chosen");
  });

  it("stops at four, and says why", async () => {
    await choose();
    for (const name of [charSiu.name, tuna.name, "Recipe A", "Recipe B"]) fireEvent.click(row(name));
    expect(screen.getByRole("status")).toHaveTextContent("4 is the most. Untick one to choose another.");
    expect(row("Recipe C")).toBeDisabled();
    fireEvent.click(row("Recipe A"));
    expect(row("Recipe C")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Compare 3 recipes" })).toBeEnabled();
  });

  it("keeps the choice while searching", async () => {
    await choose({ r: tuna.id });
    await act(async () => fireEvent.change(screen.getByRole("searchbox"), { target: { value: "noodles" } }));
    expect(screen.queryByRole("button", { name: new RegExp(`^${tuna.name}`) })).not.toBeInTheDocument();
    fireEvent.click(row(charSiu.name));
    expect(screen.getByRole("button", { name: "Compare 2 recipes" })).toBeEnabled();
  });

  it("asks for an import with fewer than two recipes", async () => {
    mocks.listRecipes.mockResolvedValue([libraryRow(tuna)]);
    await choose();
    expect(screen.getByText("Import at least two recipes to compare them")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Compare/ })).not.toBeInTheDocument();
  });
});
