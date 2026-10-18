import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useSyncExternalStore } from "react";
import { ToastProvider } from "@/components/ui/toast";
import type { LibraryRecipe } from "@/recipes/library-filter";

const mocks = vi.hoisted(() => ({
  requireHousehold: vi.fn(),
  listRecipes: vi.fn(),
  getRecipeBySlug: vi.fn(),
  getRecipeHousehold: vi.fn(),
  listPlans: vi.fn(),
  recipePlanUses: vi.fn(),
  cookie: undefined as string | undefined,
  actions: {
    setFavouriteAction: vi.fn(),
    setRatingAction: vi.fn(),
    setNotesAction: vi.fn(),
    markCookedAction: vi.fn(),
    unmarkCookedAction: vi.fn(),
    deleteRecipeAction: vi.fn(),
  },
}));
vi.mock("@/data", () => ({
  requireHousehold: mocks.requireHousehold,
  listRecipes: mocks.listRecipes,
  getRecipeBySlug: mocks.getRecipeBySlug,
  getRecipeHousehold: mocks.getRecipeHousehold,
  listPlans: mocks.listPlans,
  recipePlanUses: mocks.recipePlanUses,
}));
vi.mock("./actions", () => mocks.actions);
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
  id: `id-${slug}`,
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
  favourite: false,
  rating: null,
  lastCooked: null,
  ...extra,
});

const ctx = { householdId: "h1" };

beforeEach(() => {
  window.history.replaceState(null, "", "/recipes");
  mocks.requireHousehold.mockResolvedValue({ ctx, user: { name: "Kris Gwynne" } });
  mocks.listPlans.mockResolvedValue([]);
  mocks.recipePlanUses.mockResolvedValue([]);
  mocks.getRecipeHousehold.mockResolvedValue({ favourite: false, rating: null, notes: null, cooked: [] });
  for (const action of Object.values(mocks.actions)) action.mockResolvedValue(true);
  mocks.actions.markCookedAction.mockResolvedValue("2026-10-14");
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
    expect(screen.getByRole("link", { name: "How do I make recipe JSON?" })).toHaveAttribute(
      "href",
      "/import/help?from=recipes",
    );
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

  it("favourites from a card's heart (PP-169)", async () => {
    mocks.listRecipes.mockResolvedValue([row("Tuna pasta", "tuna-pasta"), row("Dal", "dal", { favourite: true })]);
    render(await RecipesPage());
    const [dal, tuna] = screen.getAllByRole("article");
    expect(within(dal).getByRole("button", { name: "Favourite" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(tuna).getByRole("button", { name: "Favourite" }));
    expect(mocks.actions.setFavouriteAction).toHaveBeenCalledWith("id-tuna-pasta", true);
  });

  it("marks favourites in the list view (library design B)", async () => {
    mocks.cookie = "list";
    mocks.listRecipes.mockResolvedValue([row("Tuna pasta", "tuna-pasta"), row("Dal", "dal", { favourite: true })]);
    render(await RecipesPage());
    expect(screen.getByRole("link", { name: /Dal/ })).toHaveTextContent("Favourite");
    expect(screen.getByRole("link", { name: /Tuna pasta/ })).not.toHaveTextContent("Favourite");
  });
});

describe("the recipe page", () => {
  const params = (slug: string, query: Record<string, string> = {}) => ({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(query),
  });
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
    // Compare comes first, with this recipe ticked (PP-173).
    expect(within(menu).getAllByRole("listitem")[0]).toHaveTextContent("Compare with…");
    expect(within(menu).getByRole("link", { name: "Compare with…" })).toHaveAttribute("href", `/compare/choose?r=${tuna.id}`);
    expect(within(menu).getByRole("button", { name: "Download recipe file (.json)" })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: /Replace with a new version/ })).toHaveAttribute("href", "/import");
  });

  describe("deleting it (PP-165, import design H)", () => {
    const openDelete = async () => {
      mocks.getRecipeBySlug.mockResolvedValue({ id: "r1", name: tuna.name, data: tuna });
      render(await RecipePage(params(tuna.id)));
      fireEvent.click(screen.getByRole("button", { name: "More" }));
      const items = within(screen.getByRole("dialog")).getAllByRole("listitem");
      expect(items.at(-1)).toHaveTextContent("Delete recipe…");
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete recipe…" }));
      expect(screen.getByRole("dialog")).toHaveAccessibleName(`Delete ${tuna.name}?`);
      return screen.getByRole("dialog");
    };

    it("names the plans and meals it'll disappear from", async () => {
      mocks.recipePlanUses.mockResolvedValue([
        { id: "p1", name: "This week", startDate: "2026-10-12", meals: [{ dayIndex: 1, slot: "dinner" }] },
        { id: "p2", name: "Half-term", startDate: "2026-10-26", meals: [{ dayIndex: 0, slot: "lunch" }, { dayIndex: 3, slot: "dinner" }] },
      ]);
      const sheet = await openDelete();
      expect(mocks.recipePlanUses).toHaveBeenCalledWith(ctx, "r1");
      expect(sheet).toHaveTextContent("It's planned in 2 meal plans and will be removed from them:");
      const plans = within(within(sheet).getByRole("list", { name: "Meal plans it's in" })).getAllByRole("listitem");
      expect(plans.map((p) => p.textContent)).toEqual(["This weekTue dinner", "Half-termMon lunch, Thu dinner"]);
      await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Delete recipe" })));
      expect(mocks.actions.deleteRecipeAction).toHaveBeenCalledWith("r1");
    });

    it("asks a simple confirm when it's in no plan", async () => {
      const sheet = await openDelete();
      expect(within(sheet).queryByRole("list", { name: "Meal plans it's in" })).not.toBeInTheDocument();
      expect(sheet).toHaveTextContent("Your notes, rating and cooking history for it are deleted too.");
    });

    it("says so when it fails, and stays open", async () => {
      mocks.actions.deleteRecipeAction.mockResolvedValue(false);
      const sheet = await openDelete();
      await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Delete recipe" })));
      expect(within(sheet).getByRole("alert")).toHaveTextContent("Couldn't delete the recipe. Try again.");
      expect(within(sheet).getByRole("button", { name: "Delete recipe" })).toBeEnabled();
    });
  });

  it("opens at the servings a meal plan asks for, within 1 to 50 (meal plans F)", async () => {
    mocks.getRecipeBySlug.mockResolvedValue({ name: tuna.name, data: tuna });
    const { unmount } = render(await RecipePage(params(tuna.id, { servings: "5" })));
    expect(screen.getByText("5 servings")).toBeInTheDocument();
    unmount();
    render(await RecipePage(params(tuna.id, { servings: "500" })));
    expect(screen.getByText(`${tuna.serves} servings`)).toBeInTheDocument();
  });

  it("has Add to plan in place of the tab bar, offering a plan when there are none (meal plans G)", async () => {
    mocks.getRecipeBySlug.mockResolvedValue({ id: "r1", name: tuna.name, mealType: tuna.meal_type, data: tuna });
    render(await RecipePage(params(tuna.id)));
    fireEvent.click(screen.getByRole("button", { name: "Add to plan" }));
    const sheet = screen.getByRole("dialog", { name: "Add to plan" });
    expect(within(sheet).getByText("No meal plans yet")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Create a plan" }));
    expect(screen.getByRole("dialog", { name: "New plan" })).toBeInTheDocument();
  });

  describe("the household's parts (PP-169)", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
      mocks.getRecipeBySlug.mockResolvedValue({ id: "r1", name: tuna.name, mealType: tuna.meal_type, data: tuna });
    });
    afterEach(() => vi.useRealTimers());

    const show = async (household: object = {}) => {
      mocks.getRecipeHousehold.mockResolvedValue({ favourite: false, rating: null, notes: null, cooked: [], ...household });
      render(<ToastProvider>{await RecipePage(params(tuna.id))}</ToastProvider>);
    };
    const notes = () => screen.getByRole("region", { name: "Our notes" });

    it("shows the favourite, rating, notes and history", async () => {
      await show({
        favourite: true,
        rating: 4,
        notes: { text: "Double the capers.", editedBy: "Sam Smith", editedAt: new Date("2026-10-02T09:00:00Z") },
        cooked: ["2026-10-02", "2026-09-14", "2026-08-21"],
      });
      expect(mocks.getRecipeHousehold).toHaveBeenCalledWith(ctx, "r1");
      expect(screen.getByRole("button", { name: "Favourite" })).toHaveAttribute("aria-pressed", "true");
      const card = screen.getByRole("link", { name: /Rated 4 out of 5/ });
      expect(card).toHaveAttribute("href", "#notes");
      expect(card).toHaveTextContent("Cooked 3 times · last on 2 Oct");
      expect(within(notes()).getByRole("button", { name: "Edit our notes" })).toHaveTextContent(
        "Double the capers.Edited by Sam · 2 Oct",
      );
      expect(within(notes()).getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");
      expect(within(notes()).getByText("Cooked 3 times: 2 Oct, 14 Sep, 21 Aug")).toBeInTheDocument();
    });

    it("says when there's nothing yet", async () => {
      await show();
      expect(screen.getByRole("link", { name: /Not rated/ })).toHaveTextContent("Not cooked yet");
      expect(within(notes()).getByRole("button", { name: "Add a note" })).toBeInTheDocument();
    });

    it("favourites from the heart", async () => {
      await show();
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Favourite" })));
      expect(mocks.actions.setFavouriteAction).toHaveBeenCalledWith("r1", true);
    });

    it("rates, and clears the rating by tapping it again", async () => {
      await show({ rating: 4 });
      await act(async () => fireEvent.click(within(notes()).getByRole("button", { name: "2 stars" })));
      expect(mocks.actions.setRatingAction).toHaveBeenLastCalledWith("r1", 2);
      await act(async () => fireEvent.click(within(notes()).getByRole("button", { name: "4 stars" })));
      expect(mocks.actions.setRatingAction).toHaveBeenLastCalledWith("r1", null);
    });

    it("adds a note", async () => {
      await show();
      fireEvent.click(within(notes()).getByRole("button", { name: "Add a note" }));
      const save = within(notes()).getByRole("button", { name: "Save" });
      expect(save).toBeDisabled();
      fireEvent.change(within(notes()).getByRole("textbox", { name: "Our notes" }), { target: { value: " Double the capers. " } });
      await act(async () => fireEvent.click(save));
      expect(mocks.actions.setNotesAction).toHaveBeenCalledWith("r1", "Double the capers.");
      expect(within(notes()).queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("keeps the note open when it can't be saved", async () => {
      mocks.actions.setNotesAction.mockResolvedValue(false);
      await show({ notes: { text: "Old", editedBy: "Kris", editedAt: new Date("2026-10-02T09:00:00Z") } });
      fireEvent.click(within(notes()).getByRole("button", { name: "Edit our notes" }));
      fireEvent.change(within(notes()).getByRole("textbox", { name: "Our notes" }), { target: { value: "New" } });
      await act(async () => fireEvent.click(within(notes()).getByRole("button", { name: "Save" })));
      expect(within(notes()).getByRole("textbox", { name: "Our notes" })).toHaveValue("New");
      expect(screen.getByRole("status")).toHaveTextContent("Couldn't save the notes. Try again.");
    });

    it("marks it cooked today, with Undo", async () => {
      await show({ cooked: ["2026-10-02"] });
      const bar = screen.getByRole("button", { name: "Cooked today" });
      expect(bar).toHaveAttribute("aria-pressed", "false");
      await act(async () => fireEvent.click(bar));
      expect(mocks.actions.markCookedAction).toHaveBeenCalledWith("r1");
      const toast = screen.getByRole("status");
      expect(toast).toHaveTextContent("Marked as cooked today");
      await act(async () => fireEvent.click(within(toast).getByRole("button", { name: "Undo" })));
      expect(mocks.actions.unmarkCookedAction).toHaveBeenCalledWith("r1", "2026-10-14");
    });

    it("takes today out when tapped again", async () => {
      await show({ cooked: ["2026-10-14", "2026-10-02"] });
      const bar = screen.getByRole("button", { name: "Cooked today" });
      expect(bar).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("link", { name: /Not rated/ })).toHaveTextContent("Cooked twice · last today");
      await act(async () => fireEvent.click(bar));
      expect(mocks.actions.unmarkCookedAction).toHaveBeenCalledWith("r1", "2026-10-14");
      expect(mocks.actions.markCookedAction).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent("Removed today");
    });

    it("says so when Cooked today can't be saved", async () => {
      mocks.actions.markCookedAction.mockResolvedValue(null);
      await show();
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cooked today" })));
      expect(screen.getByRole("status")).toHaveTextContent("Couldn't save that. Try again.");
    });
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
