import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { createTestDb } from "@/db/test-db";
import { addEntry, createPlan, getPlan, listPlans, saveRecipe } from "@/data";
import { twoHouseholds, type TwoHouseholds } from "@/data/test-fixtures";
import { ToastProvider } from "@/components/ui/toast";
import type { Recipe } from "@/types/recipe";

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  user: { id: "kris", name: "Kris", email: "kris@example.com", image: null },
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
  back: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/auth", () => ({ requireUser: async () => mocks.user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Next keeps useSearchParams in step with the history API; this does the same in jsdom.
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const listeners = new Set<() => void>();
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      original(...args);
      listeners.forEach((l) => l());
    };
  }
  const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
  return {
    redirect: mocks.redirect,
    notFound: () => {
      throw new Error("NEXT_NOT_FOUND");
    },
    usePathname: () => window.location.pathname,
    useRouter: () => ({ back: mocks.back, replace: mocks.replace, push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});

const { default: PlansPage } = await import("./page");
const { default: PlanPage } = await import("./[id]/page");
const { default: AddRecipePage } = await import("./[id]/add/page");
const { default: RecipePage } = await import("../recipes/[slug]/page");
const {
  addEntryAction,
  createPlanAction,
  copyPlanAction,
  deletePlanAction,
  moveEntryAction,
  planGridAction,
  removeEntryAction,
  setPortionsAction,
  updatePlanAction,
} = await import("./actions");

const tunaPasta: Recipe = JSON.parse(readFileSync("examples/lemony-tuna-tomato-caper-pasta.json", "utf8"));
const tofoo: Recipe = JSON.parse(readFileSync("examples/char-siu-tofoo-noodles.json", "utf8"));
const thisWeek = { name: "This week", startDate: "2026-10-12", days: 7, people: 2 };

const form = (fields: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
};
const openPlan = async (id: string) => render(<ToastProvider>{await PlanPage({ params: Promise.resolve({ id }) })}</ToastProvider>);
const openPicker = async (id: string, query: Record<string, string>) => {
  window.history.replaceState(null, "", `/plans/${id}/add?${new URLSearchParams(query)}`);
  return render(
    <ToastProvider>
      {await AddRecipePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) })}
    </ToastProvider>,
  );
};

let h: TwoHouseholds;
let tuna: string;

beforeEach(async () => {
  // Tuesday 13 October 2026, in the UK.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
  tuna = (await saveRecipe(h.a, tunaPasta)).id;
  mocks.redirect.mockClear();
  mocks.back.mockClear();
  mocks.replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("plan list", () => {
  it("offers to create the first plan, starting today (B, C)", async () => {
    render(await PlansPage());
    expect(screen.getByText("No meal plans yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create a plan" }));
    const sheet = screen.getByRole("dialog", { name: "New plan" });
    expect(within(sheet).getByRole("textbox", { name: "Name" })).toHaveValue("Week of 13 Oct");
    expect(within(sheet).getByText("Tuesday 13 October")).toBeInTheDocument();
    expect(within(sheet).getByText("13 – 19 Oct")).toBeInTheDocument();
    expect(within(sheet).queryByText("The day after your latest plan ends")).not.toBeInTheDocument();
  });

  it("groups plans into this week, coming up and past, with meals per plan (A)", async () => {
    const now = await createPlan(h.a, thisWeek);
    await addEntry(h.a, now, { dayIndex: 0, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, now, { dayIndex: 2, slot: "lunch", recipeId: tuna });
    await createPlan(h.a, { ...thisWeek, name: "Half term", startDate: "2026-10-19", people: 3 });
    await createPlan(h.a, { ...thisWeek, name: "Week of 5 Oct", startDate: "2026-10-05" });
    await createPlan(h.a, { ...thisWeek, name: "Week of 28 Sep", startDate: "2026-09-28" });
    await createPlan(h.b, { ...thisWeek, name: "B's week" });

    render(await PlansPage());
    expect(screen.getAllByRole("heading", { level: 2 }).map((h2) => h2.textContent)).toEqual([
      "This week",
      "Coming up",
      "Past",
    ]);
    expect(screen.getByRole("link", { name: /This week.*Mon 12 – Sun 18 Oct · 2 people.*2 meals/ })).toHaveAttribute(
      "href",
      `/plans/${now}`,
    );
    expect(screen.getByRole("link", { name: /Half term.*Mon 19 – Sun 25 Oct · 3 people.*0 meals · 7 days empty/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Week of 5 Oct.*5 – 11 Oct · 0 meals/ })).toBeInTheDocument();
    expect(screen.queryByText("Week of 28 Sep")).not.toBeInTheDocument();
    expect(screen.queryByText("B's week")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 1 older plan" }));
    expect(screen.getByText("Week of 28 Sep")).toBeInTheDocument();
  });

  it("starts a new plan after the latest one, its name following the date until typed over (C)", async () => {
    await createPlan(h.a, thisWeek);
    render(await PlansPage());
    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    const sheet = screen.getByRole("dialog", { name: "New plan" });
    const name = within(sheet).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Week of 19 Oct");
    expect(within(sheet).getByText("Monday 19 October")).toBeInTheDocument();
    expect(within(sheet).getByText("The day after your latest plan ends")).toBeInTheDocument();

    fireEvent.change(within(sheet).getByLabelText("Start date"), { target: { value: "2026-10-26" } });
    expect(name).toHaveValue("Week of 26 Oct");
    fireEvent.change(name, { target: { value: "Half term" } });
    fireEvent.change(within(sheet).getByLabelText("Start date"), { target: { value: "2026-10-20" } });
    expect(name).toHaveValue("Half term");

    fireEvent.click(within(sheet).getByRole("button", { name: "More days" }));
    expect(within(sheet).getByText("20 – 27 Oct")).toBeInTheDocument();
  });
});

describe("plan actions", () => {
  it("creates a plan and opens it", async () => {
    await expect(createPlanAction({}, form({ ...thisWeek, name: " Our week " }))).rejects.toThrow(/^redirect \/plans\//);
    const [plan] = await listPlans(h.a);
    expect(plan).toMatchObject({ ...thisWeek, name: "Our week" });
    expect(mocks.redirect).toHaveBeenCalledWith(`/plans/${plan.id}`);
  });

  it("explains a missing name and saves nothing", async () => {
    expect(await createPlanAction({}, form({ ...thisWeek, name: "" }))).toEqual({
      errors: { name: "Enter a name for the plan" },
    });
    expect(await listPlans(h.a)).toEqual([]);
  });

  it("copies a plan with its meals and opens the copy", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tuna, portionsPerPerson: 1.5 });
    await expect(
      copyPlanAction({}, form({ planId: id, ...thisWeek, name: "Copy of This week", startDate: "2026-10-19" })),
    ).rejects.toThrow(/^redirect/);
    const copy = (await listPlans(h.a)).find((p) => p.id !== id)!;
    expect(copy).toMatchObject({ name: "Copy of This week", startDate: "2026-10-19", mealsByDay: [0, 1, 0, 0, 0, 0, 0] });
  });

  it("doesn't copy, change or delete another household's plan", async () => {
    const theirs = await createPlan(h.b, thisWeek);
    expect(await copyPlanAction({}, form({ planId: theirs, ...thisWeek }))).toEqual({
      errors: { form: "That plan no longer exists" },
    });
    expect(await updatePlanAction({}, form({ planId: theirs, ...thisWeek, name: "Mine" }))).toEqual({
      errors: { form: "That plan no longer exists" },
    });
    await expect(deletePlanAction(theirs)).rejects.toThrow("redirect /plans");
    expect(await getPlan(h.b, theirs)).toMatchObject({ name: "This week" });
    expect(await listPlans(h.a)).toEqual([]);
  });

  it("deletes a plan and goes back to the list", async () => {
    const id = await createPlan(h.a, thisWeek);
    await expect(deletePlanAction(id)).rejects.toThrow("redirect /plans");
    expect(await getPlan(h.a, id)).toBeNull();
  });
});

describe("plan page", () => {
  it("shows each day with today marked, its meals in order, and empty days (D, I)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tuna, portionsPerPerson: 1.5 });
    await addEntry(h.a, id, { dayIndex: 1, slot: "breakfast", recipeId: tuna });
    await openPlan(id);

    expect(screen.getByRole("heading", { level: 1, name: "This week" })).toBeInTheDocument();
    expect(screen.getByText("Mon 12 – Sun 18 Oct · 2 people")).toBeInTheDocument();
    const days = screen.getAllByRole("listitem").filter((li) => li.id.startsWith("day-"));
    expect(days.map((d) => within(d).getByRole("heading", { level: 2 }).textContent)).toEqual([
      "Mon 12 Oct",
      "Tue 13 Oct",
      "Wed 14 Oct",
      "Thu 15 Oct",
      "Fri 16 Oct",
      "Sat 17 Oct",
      "Sun 18 Oct",
    ]);
    expect(within(days[0]).getByText("Nothing planned")).toBeInTheDocument();
    const tuesday = days[1];
    expect(within(tuesday).getByText("Today")).toBeInTheDocument();
    expect(within(tuesday).getAllByRole("heading", { level: 3 }).map((h3) => h3.textContent)).toEqual(["Breakfast", "Dinner"]);
    const dinner = within(tuesday).getByRole("region", { name: "Dinner" });
    expect(within(dinner).getByRole("button", { name: /Lemony tuna.*Fish.*1½ each/ })).toBeInTheDocument();
  });

  it("is a 404 for another household's plan or a made-up id", async () => {
    const theirs = await createPlan(h.b, thisWeek);
    await expect(openPlan(theirs)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(openPlan("not-a-plan")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("warns which meals fewer days will remove, and saves the edit (K)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 5, slot: "breakfast", recipeId: tuna });
    await addEntry(h.a, id, { dayIndex: 5, slot: "dinner", recipeId: tuna });
    await openPlan(id);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit name, dates and people" }));
    const sheet = screen.getByRole("dialog", { name: "Edit plan" });
    expect(within(sheet).getByRole("textbox", { name: "Name" })).toHaveValue("This week");

    fireEvent.click(within(sheet).getByRole("button", { name: "Fewer days" }));
    expect(within(sheet).queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Fewer days" }));
    expect(within(sheet).getByRole("status")).toHaveTextContent(
      "2 meals will be removedSat 17 Oct has 2 meals planned. They'll be taken out of the plan when you save.",
    );

    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Save" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await getPlan(h.a, id)).toMatchObject({ days: 5, entries: [] });
  });

  it("copies to a new plan starting after this one (J)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await openPlan(id);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByText("Same meals, starting Mon 19 Oct")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Copy to a new plan/ }));
    const sheet = screen.getByRole("dialog", { name: "Copy to a new plan" });
    expect(within(sheet).getByRole("textbox", { name: "Name" })).toHaveValue("Copy of This week");
    expect(within(sheet).getByText("Monday 19 October")).toBeInTheDocument();
  });

  it("asks before deleting a plan with meals (L)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 0, slot: "dinner", recipeId: tuna });
    await openPlan(id);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete plan" }));
    const sheet = screen.getByRole("dialog", { name: 'Delete "This week"?' });
    expect(sheet).toHaveTextContent("It has 1 meal planned. The recipes stay in your library.");
  });
});

describe("filling a plan (PP-171)", () => {
  /** The phone layout's card for a day ("day-1"); the wide grid repeats the plan for md up. */
  const dayCard = (dayIndex: number) => document.getElementById(`day-${dayIndex}`)!;

  it("has a + for every meal on a planned day, and on an empty day once tapped (D, I)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tuna });
    await openPlan(id);

    const tuesday = dayCard(1);
    expect(within(tuesday).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(
      ["breakfast", "lunch", "dinner", "snack"].map((slot) => `/plans/${id}/add?day=1&slot=${slot}&meal=${slot}`),
    );
    expect(within(tuesday).getByRole("link", { name: "Add dinner, Tue 13 Oct" })).toBeInTheDocument();

    const monday = dayCard(0);
    expect(within(monday).queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(within(monday).getByRole("button", { name: /Mon 12 Oct.*Nothing planned/ }));
    expect(within(monday).getAllByRole("link")).toHaveLength(4);
  });

  it("has a strip of days to jump between, the day being read in ink (D)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await openPlan(id);
    const strip = screen.getByRole("list", { name: "Days of This week" });
    const days = within(strip).getAllByRole("link");
    expect(days.map((a) => a.textContent)).toEqual(["Mon12", "Tue13", "Wed14", "Thu15", "Fri16", "Sat17", "Sun18"]);
    expect(days[3]).toHaveAttribute("href", "#day-3");
  });

  it("changes portions each as they're tapped, and opens the recipe scaled to them (F)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tuna });
    await openPlan(id);
    fireEvent.click(within(dayCard(1)).getByRole("button", { name: /Lemony tuna/ }));
    const sheet = screen.getByRole("dialog", { name: tunaPasta.name });
    expect(sheet).toHaveTextContent("Tue 13 Oct · Dinner");
    expect(sheet).toHaveTextContent("2 people × 1 = 2 servings");

    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "More portions each" })));
    expect(sheet).toHaveTextContent("2 people × 1½ = 3 servings");
    await waitFor(async () => expect((await getPlan(h.a, id))!.entries[0].portionsPerPerson).toBe(1.5));
    expect(within(sheet).getByRole("link", { name: "Recipe" })).toHaveAttribute(
      "href",
      "/recipes/lemony-tuna-tomato-caper-pasta?servings=3",
    );
  });

  it("removes a planned recipe, with Undo putting it back (F, I)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tuna, portionsPerPerson: 2 });
    await openPlan(id);
    fireEvent.click(within(dayCard(1)).getByRole("button", { name: /Lemony tuna/ }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remove" })));

    await waitFor(() => expect(screen.getByText("Removed from Tue dinner")).toBeInTheDocument());
    expect((await getPlan(h.a, id))!.entries).toEqual([]);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Undo" })));
    await waitFor(async () =>
      expect((await getPlan(h.a, id))!.entries).toMatchObject([{ dayIndex: 1, slot: "dinner", portionsPerPerson: 2 }]),
    );
  });

  it("moves a planned recipe to another day and meal (G)", async () => {
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: tuna });
    await openPlan(id);
    fireEvent.click(within(dayCard(1)).getByRole("button", { name: /Lemony tuna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    const sheet = screen.getByRole("dialog", { name: "Move to…" });
    expect(within(sheet).getByRole("button", { name: "Tue 13 Oct, dinner: here now" })).toBeInTheDocument();
    const button = within(sheet).getByRole("button", { name: "Choose a day and meal" });
    expect(button).toBeDisabled();
    fireEvent.click(within(sheet).getByRole("button", { name: "Wed 14 Oct, lunch: nothing planned" }));
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Move to Wed lunch" })));

    await waitFor(() => expect(screen.getByText("Moved to Wed lunch")).toBeInTheDocument());
    expect((await getPlan(h.a, id))!.entries).toMatchObject([{ dayIndex: 2, slot: "lunch" }]);
  });
});

describe("recipe picker (E)", () => {
  it("starts filtered to the meal, which can be removed", async () => {
    await saveRecipe(h.a, tofoo);
    const id = await createPlan(h.a, thisWeek);
    await openPicker(id, { day: "2", slot: "lunch", meal: "lunch" });

    expect(screen.getByRole("heading", { level: 1, name: "Add lunch" })).toBeInTheDocument();
    expect(screen.getByText("Wed 14 Oct · This week")).toBeInTheDocument();
    // Both examples are dinners.
    expect(screen.getByText("No recipes match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Lunch" }));
    expect(screen.getByText("2 recipes")).toBeInTheDocument();
    expect(window.location.search).toBe("?day=2&slot=lunch");
  });

  it("adds the tapped recipe with 1 portion each, goes back and offers Undo", async () => {
    await saveRecipe(h.a, tofoo);
    const id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 3, slot: "dinner", recipeId: tuna });
    await openPicker(id, { day: "2", slot: "dinner", meal: "dinner" });

    const list = screen.getByRole("list", { name: "Recipes" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^Char siu Tofoo noodles.*Serves 2$/),
      expect.stringMatching(/^Lemony tuna.*Serves 4 · In this plan: Thu dinner$/),
    ]);
    await act(async () => fireEvent.click(within(list).getByRole("button", { name: /Char siu/ })));

    await waitFor(() => expect(screen.getByText("Added to Wed dinner")).toBeInTheDocument());
    // Back to the plan: back in history, or (opened directly) to the day.
    expect([...mocks.back.mock.calls, ...mocks.replace.mock.calls]).toHaveLength(1);
    const added = (await getPlan(h.a, id))!.entries.find((e) => e.dayIndex === 2)!;
    expect(added).toMatchObject({ slot: "dinner", portionsPerPerson: 1, recipe: { slug: tofoo.id } });

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Undo" })));
    await waitFor(async () => expect((await getPlan(h.a, id))!.entries).toHaveLength(1));
  });

  it("offers Import when the library is empty", async () => {
    const empty = await createPlan(h.b, thisWeek);
    mocks.user = { ...mocks.user, id: "alex" };
    try {
      await openPicker(empty, { day: "0", slot: "dinner", meal: "dinner" });
      expect(screen.getByText("No recipes yet")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Import recipes" })).toHaveAttribute("href", "/import");
    } finally {
      mocks.user = { ...mocks.user, id: "kris" };
    }
  });

  it("is a 404 for another household's plan, a day outside the plan or an unknown meal", async () => {
    const id = await createPlan(h.a, thisWeek);
    const theirs = await createPlan(h.b, thisWeek);
    await expect(openPicker(theirs, { day: "0", slot: "dinner" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(openPicker(id, { day: "7", slot: "dinner" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(openPicker(id, { day: "x", slot: "dinner" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(openPicker(id, { day: "0", slot: "brunch" })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("Add to plan from a recipe page (G)", () => {
  const openRecipe = async () =>
    render(
      <ToastProvider>
        {await RecipePage({ params: Promise.resolve({ slug: tunaPasta.id }), searchParams: Promise.resolve({}) })}
      </ToastProvider>,
    );

  it("picks the current plan, switches to a later one, and adds to the chosen day and meal", async () => {
    await createPlan(h.a, { ...thisWeek, name: "Last week", startDate: "2026-10-05" });
    const now = await createPlan(h.a, thisWeek);
    const next = await createPlan(h.a, { ...thisWeek, name: "Half term", startDate: "2026-10-19" });
    await addEntry(h.a, now, { dayIndex: 0, slot: "dinner", recipeId: tuna });
    await openRecipe();

    fireEvent.click(screen.getByRole("button", { name: "Add to plan" }));
    const sheet = screen.getByRole("dialog", { name: "Add to plan" });
    await waitFor(() => expect(within(sheet).getByRole("table")).toBeInTheDocument());
    expect(within(sheet).getByRole("button", { name: /This week/ })).toBeInTheDocument();
    // The recipe's meal type is in bold.
    expect(within(sheet).getByRole("columnheader", { name: "Dinner" })).toHaveClass("font-semibold");
    expect(within(sheet).getByRole("button", { name: "Mon 12 Oct, dinner: 1 recipe planned" })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: /This week/ }));
    const plans = within(sheet).getByRole("list", { name: "Plans" });
    expect(within(plans).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("This week"),
      expect.stringContaining("Half term"),
    ]);
    fireEvent.click(within(plans).getByRole("button", { name: /Half term/ }));
    await waitFor(() => expect(within(sheet).getByRole("button", { name: /Tue 20 Oct, dinner/ })).toBeInTheDocument());
    fireEvent.click(within(sheet).getByRole("button", { name: "Tue 20 Oct, dinner: nothing planned" }));
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Add to Tue dinner" })));

    await waitFor(() => expect(screen.getByText("Added to Tue dinner")).toBeInTheDocument());
    expect((await getPlan(h.a, next))!.entries).toMatchObject([{ dayIndex: 1, slot: "dinner", portionsPerPerson: 1 }]);
  });
});

describe("entry actions", () => {
  it("can't add to, change, move, remove or read another household's plan", async () => {
    const theirs = await createPlan(h.b, thisWeek);
    const theirRecipe = (await saveRecipe(h.b, tunaPasta)).id;
    const theirEntry = (await addEntry(h.b, theirs, { dayIndex: 0, slot: "dinner", recipeId: theirRecipe }))!;
    const mine = await createPlan(h.a, thisWeek);

    expect(await addEntryAction(theirs, { dayIndex: 0, slot: "lunch", recipeId: tuna })).toBeNull();
    // Nor put their recipe in my plan.
    expect(await addEntryAction(mine, { dayIndex: 0, slot: "lunch", recipeId: theirRecipe })).toBeNull();
    expect(await setPortionsAction(theirs, theirEntry, 2)).toBe(false);
    expect(await moveEntryAction(theirs, theirEntry, { dayIndex: 3, slot: "lunch" })).toBe(false);
    expect(await removeEntryAction(theirs, theirEntry)).toBe(false);
    expect(await planGridAction(theirs)).toBeNull();
    expect((await getPlan(h.b, theirs))!.entries).toMatchObject([{ id: theirEntry, dayIndex: 0, slot: "dinner", portionsPerPerson: 1 }]);
    expect((await getPlan(h.a, mine))!.entries).toEqual([]);
  });
});
