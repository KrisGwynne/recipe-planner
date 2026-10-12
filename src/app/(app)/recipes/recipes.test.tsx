import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useSyncExternalStore } from "react";
import type { LibraryRecipe } from "@/recipes/library-filter";

const mocks = vi.hoisted(() => ({
  requireHousehold: vi.fn(),
  listRecipes: vi.fn(),
  getRecipeBySlug: vi.fn(),
  cookie: undefined as string | undefined,
}));
vi.mock("@/data", () => ({
  requireHousehold: mocks.requireHousehold,
  listRecipes: mocks.listRecipes,
  getRecipeBySlug: mocks.getRecipeBySlug,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "recipes-view" && mocks.cookie ? { value: mocks.cookie } : undefined) }),
}));
// Next keeps useSearchParams in step with history.pushState; this does the same in jsdom.
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
  window.addEventListener("popstate", notify);
  const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
  return {
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
    usePathname: () => "/recipes",
    useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});

const { default: RecipesPage } = await import("./page");
const { default: RecipePage } = await import("./[slug]/page");

const row = (name: string, slug: string, extra: Partial<LibraryRecipe> = {}): LibraryRecipe => ({
  slug,
  name,
  totalMins: 35,
  kcal: 672,
  proteinG: 29,
  nutritionSource: "printed",
  proteinType: "fish",
  proteinItems: ["tuna"],
  dietary: [],
  carbs: ["pasta"],
  hasVeggieOption: false,
  cuisine: "italian",
  difficulty: "easy",
  mealType: ["dinner"],
  spiceLevel: "none",
  sourceKind: "magazine",
  sourceTitle: "BBC Good Food",
  createdAt: "2026-10-01T00:00:00Z",
  equipment: ["hob"],
  freezable: false,
  ingredients: [{ item: "dried pasta", prep: null }],
  ...extra,
});

const ctx = { householdId: "h1" };

beforeEach(() => {
  window.history.replaceState(null, "", "/recipes");
  mocks.requireHousehold.mockResolvedValue({ ctx });
  mocks.cookie = undefined;
  document.cookie = "recipes-view=; max-age=0; path=/";
});
afterEach(() => vi.clearAllMocks());

describe("the recipe library", () => {
  it("asks for an import when the library is empty", async () => {
    mocks.listRecipes.mockResolvedValue([]);
    render(await RecipesPage());
    expect(mocks.listRecipes).toHaveBeenCalledWith(ctx);
    expect(screen.getByText("Your recipe book is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import recipes" })).toHaveAttribute("href", "/import");
    expect(screen.queryByRole("group", { name: "View" })).not.toBeInTheDocument();
  });

  it("shows the household's recipes as cards by default, with the count", async () => {
    mocks.listRecipes.mockResolvedValue([row("Char siu Tofoo noodles", "char-siu"), row("Tuna pasta", "tuna-pasta")]);
    render(await RecipesPage());
    expect(screen.getByText("2 recipes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cards" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Tuna pasta" })).toHaveAttribute("href", "/recipes/tuna-pasta");
  });

  it("says 1 recipe for one", async () => {
    mocks.listRecipes.mockResolvedValue([row("Tuna pasta", "tuna-pasta")]);
    render(await RecipesPage());
    expect(screen.getByText("1 recipe")).toBeInTheDocument();
  });

  it("opens in the list view when the cookie says so", async () => {
    mocks.cookie = "list";
    mocks.listRecipes.mockResolvedValue([row("Tuna pasta", "tuna-pasta")]);
    render(await RecipesPage());
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tuna pasta/ })).toHaveTextContent("35 min · 672 kcal · 29g protein · Pasta");
  });

  it("switches view and remembers the choice in a cookie", async () => {
    mocks.listRecipes.mockResolvedValue([row("Tuna pasta", "tuna-pasta")]);
    render(await RecipesPage());
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(document.cookie).toContain("recipes-view=list");
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(document.cookie).toContain("recipes-view=cards");
  });

  it("shows meat & fish recipes with both items", async () => {
    mocks.listRecipes.mockResolvedValue([
      row("Surf and turf", "surf-and-turf", { proteinType: "meat-and-fish", proteinItems: ["beef", "prawns"] }),
    ]);
    render(await RecipesPage());
    expect(within(screen.getByRole("article")).getByText("Meat & fish · Beef, prawns")).toBeInTheDocument();
  });
});

describe("the recipe page", () => {
  const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
  const tuna = JSON.parse(readFileSync("examples/lemony-tuna-tomato-caper-pasta.json", "utf8"));

  it("shows the household's recipe by slug", async () => {
    mocks.getRecipeBySlug.mockResolvedValue({ name: tuna.name, data: tuna });
    render(await RecipePage(params(tuna.id)));
    expect(mocks.getRecipeBySlug).toHaveBeenCalledWith(ctx, tuna.id);
    expect(screen.getByRole("heading", { level: 1, name: tuna.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("offers the recipe file and a new version from the ⋯ menu", async () => {
    mocks.getRecipeBySlug.mockResolvedValue({ name: tuna.name, data: tuna });
    render(await RecipePage(params(tuna.id)));
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const menu = screen.getByRole("dialog");
    expect(within(menu).getByRole("button", { name: "Download recipe file (.json)" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: /Replace with a new version/ })).toHaveAttribute("href", "/import");
  });

  it("is not found when the household has no such recipe", async () => {
    mocks.getRecipeBySlug.mockResolvedValue(null);
    await expect(RecipePage(params("someone-elses"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("search, filters and sort (PP-167)", () => {
  const library = () => [
    row("Lemony tuna pasta", "tuna-pasta", { carbs: ["pasta"], hasVeggieOption: true, totalMins: 35 }),
    row("Char siu Tofoo noodles", "tofoo", {
      proteinType: "vegetarian",
      proteinItems: ["tofu"],
      dietary: ["vegetarian"],
      carbs: ["noodles"],
      totalMins: 55,
      kcal: 825,
      ingredients: [{ item: "Naked Tofoo", prep: "pressed" }],
      sourceKind: "book",
      sourceTitle: "Tofoo cookbook",
    }),
    row("Prawn rice-paper rolls", "rolls", {
      proteinItems: ["prawns"],
      carbs: ["none"],
      totalMins: 20,
      kcal: 390,
      ingredients: [{ item: "sushi-grade tuna", prep: "diced" }],
    }),
  ];

  it("searches as you type, marking the match and showing a matched ingredient", async () => {
    mocks.listRecipes.mockResolvedValue(library());
    render(await RecipesPage());
    fireEvent.change(screen.getByRole("searchbox", { name: "Search recipes" }), { target: { value: "tuna" } });
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 recipes match “tuna”");
    expect(screen.getAllByText("tuna", { selector: "mark" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Ingredient:").parentElement).toHaveTextContent("Ingredient: sushi-grade tuna, diced");
    expect(window.location.search).toBe("?q=tuna");
  });

  it("filters in a sheet that says how many it will show, then shows chips", async () => {
    mocks.listRecipes.mockResolvedValue(library());
    render(await RecipesPage());
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Fish 2" }));
    // Type of fish opens inside the section.
    fireEvent.click(within(sheet).getByRole("button", { name: "Tuna 1" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Pasta 1" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Show 1 recipe" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters · 2" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).getAll("item")).toEqual(["fish:tuna"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Fish: Tuna" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Filters · 1" })).toBeInTheDocument();
  });

  it("closing the sheet without Show keeps the old filters", async () => {
    mocks.listRecipes.mockResolvedValue(library());
    render(await RecipesPage());
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Veg 1" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("opens with the filters in the URL", async () => {
    window.history.replaceState(null, "", "/recipes?cat=veg");
    mocks.listRecipes.mockResolvedValue(library());
    render(await RecipesPage());
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Char siu Tofoo noodles" })).toBeInTheDocument();
  });

  it("sorts from the sort sheet, bolding the number in the list view", async () => {
    mocks.cookie = "list";
    mocks.listRecipes.mockResolvedValue(library());
    render(await RecipesPage());
    fireEvent.click(screen.getByRole("button", { name: /Sort: Name, A to Z/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Sort by" })).getByRole("button", { name: "Quickest first" }));
    const links = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(links).toEqual(["/recipes/rolls", "/recipes/tuna-pasta", "/recipes/tofoo"]);
    expect(screen.getByText("20 min", { selector: "b" })).toBeInTheDocument();
    expect(window.location.search).toBe("?sort=quickest");
  });

  it("suggests filters to remove when nothing matches", async () => {
    window.history.replaceState(null, "", "/recipes?cat=veg&time=20");
    mocks.listRecipes.mockResolvedValue(library());
    render(await RecipesPage());
    expect(screen.getByText("No recipes match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Remove “Up to 20 min”/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("clears a search that finds nothing", async () => {
    mocks.listRecipes.mockResolvedValue(library());
    render(await RecipesPage());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "lasagne" } });
    expect(screen.getByText("No recipes match")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear search" }).at(-1)!);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
});
