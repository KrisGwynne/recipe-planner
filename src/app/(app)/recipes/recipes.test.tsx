import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipeListRow } from "@/recipes/summary";

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
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: RecipesPage } = await import("./page");
const { default: RecipePage } = await import("./[slug]/page");

const row = (name: string, slug: string, extra: Partial<RecipeListRow> = {}): RecipeListRow => ({
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
  ...extra,
});

const ctx = { householdId: "h1" };

beforeEach(() => {
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
    expect(screen.getByRole("link")).toHaveTextContent("35 min · 672 kcal · 29g protein · Pasta");
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

describe("the recipe page placeholder", () => {
  const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it("shows the household's recipe by slug", async () => {
    mocks.getRecipeBySlug.mockResolvedValue({ name: "Tuna pasta" });
    render(await RecipePage(params("tuna-pasta")));
    expect(mocks.getRecipeBySlug).toHaveBeenCalledWith(ctx, "tuna-pasta");
    expect(screen.getByRole("heading", { level: 1, name: "Tuna pasta" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to recipes" })).toHaveAttribute("href", "/recipes");
  });

  it("is not found when the household has no such recipe", async () => {
    mocks.getRecipeBySlug.mockResolvedValue(null);
    await expect(RecipePage(params("someone-elses"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
