import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { createTestDb } from "@/db/test-db";
import {
  addEntry,
  addFromFreezer,
  addLeftovers,
  addToFreezer,
  createPlan,
  freezeLeftovers,
  getPlan,
  listFreezer,
  listPlans,
  saveRecipe,
} from "@/data";
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
const { default: NutritionPage } = await import("./[id]/nutrition/page");
const { default: FreezerPage } = await import("./freezer/page");
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

describe("totals and leftovers (PP-172)", () => {
  const dayCard = (dayIndex: number) => document.getElementById(`day-${dayIndex}`)!;
  let id: string;

  // 2 people: Mon tuna pasta (serves 4) at 1 each; Tue Tofoo noodles
  // (serves 2, estimated) at 1 each and tuna pasta at 1½ each for lunch.
  beforeEach(async () => {
    const noodles = (await saveRecipe(h.a, tofoo)).id;
    id = await createPlan(h.a, thisWeek);
    await addEntry(h.a, id, { dayIndex: 0, slot: "dinner", recipeId: tuna });
    await addEntry(h.a, id, { dayIndex: 1, slot: "dinner", recipeId: noodles });
    await addEntry(h.a, id, { dayIndex: 1, slot: "lunch", recipeId: tuna, portionsPerPerson: 1.5 });
  });

  it("shows each day's total and each recipe's nutrition and leftovers per person (D, I)", async () => {
    await openPlan(id);
    expect(dayCard(0)).toHaveTextContent("Each person: 672 kcal");
    expect(within(dayCard(0)).getByRole("button", { name: /Lemony tuna/ })).toHaveTextContent(
      "1 each · 672 kcal · 29g protein2 left over",
    );
    // Tuesday includes the estimated noodles.
    expect(dayCard(1)).toHaveTextContent("Each person: ~1,833 kcal");
    expect(within(dayCard(1)).getByRole("button", { name: /Lemony tuna/ })).toHaveTextContent(
      "1½ each · 1,008 kcal · 44g protein1 left over",
    );
    const noodles = within(dayCard(1)).getByRole("button", { name: /Tofoo/ });
    expect(noodles).toHaveTextContent("1 each · ~825 kcal · ~31g protein");
    expect(noodles).not.toHaveTextContent("left over");
  });

  it("averages over the days planned, linking to the nutrition page (D)", async () => {
    await openPlan(id);
    const [wide, card] = screen.getAllByRole("link", { name: /a day/i });
    expect(card).toHaveTextContent("Each person, a day on average~1,253 kcalP ~52g · C ~150g · F ~46g");
    expect(card).toHaveAttribute("href", `/plans/${id}/nutrition`);
    expect(card).toHaveClass("border-dashed");
    expect(wide).toHaveTextContent("A day, each: ~1,253 kcal · P ~52g · C ~150g · F ~46g");
  });

  it("has no average on an empty plan", async () => {
    await openPlan(await createPlan(h.a, { ...thisWeek, name: "Empty" }));
    expect(screen.queryByRole("link", { name: /a day/i })).not.toBeInTheDocument();
  });

  it("puts each person's totals along the bottom of the wide grid", async () => {
    await openPlan(id);
    const row = screen.getByRole("rowheader", { name: "Each person" }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "672 kcalP 29 · C 83 · F 23",
      "~1,833 kcalP ~75 · C ~217 · F ~69",
      ...Array(5).fill("Nothing planned"),
    ]);
  });

  it("updates the leftovers and what each person gets as portions change (F)", async () => {
    await openPlan(id);
    fireEvent.click(within(dayCard(0)).getByRole("button", { name: /Lemony tuna/ }));
    const sheet = screen.getByRole("dialog", { name: tunaPasta.name });
    expect(sheet).toHaveTextContent("2 servings left overThe recipe makes 4; 2 are eaten at this meal.2 not planned yet");
    expect(sheet).toHaveTextContent("Each person getsPrinted672 kcalProtein 29g · Carbs 83g · Fat 23g");

    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "More portions each" })));
    expect(sheet).toHaveTextContent("1 serving left overThe recipe makes 4; 3 are eaten at this meal.1 not planned yet");
    expect(sheet).toHaveTextContent("1,008 kcal");

    // 2 people × 2 each eat it all: no leftovers box.
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "More portions each" })));
    expect(sheet).not.toHaveTextContent("left over");
    // 2 × 2½ is more than it makes: still nothing to flag (Kris, 2026-10-14).
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "More portions each" })));
    expect(sheet).not.toHaveTextContent("left over");
  });

  it("marks estimated nutrition in the entry sheet (F)", async () => {
    await openPlan(id);
    fireEvent.click(within(dayCard(1)).getByRole("button", { name: /Tofoo/ }));
    expect(screen.getByRole("dialog", { name: tofoo.name })).toHaveTextContent(
      "Each person gets~ Estimated~825 kcalProtein ~31g · Carbs ~92g · Fat ~34g",
    );
  });

  it("shows the leftovers line when moving a recipe (G)", async () => {
    await openPlan(id);
    fireEvent.click(within(dayCard(1)).getByRole("button", { name: /Lemony tuna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(screen.getByRole("dialog", { name: "Move to…" })).toHaveTextContent(
      "Serves 4 · 2 people × 1½ each = 3 · 1 left over",
    );
  });

  it("shows the plan's nutrition, each day and which recipes are estimated (H)", async () => {
    render(await NutritionPage({ params: Promise.resolve({ id }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Nutrition" })).toBeInTheDocument();
    expect(screen.getByText("This week · each person")).toBeInTheDocument();
    const average = screen.getByRole("region", { name: "A day on average" });
    expect(average).toHaveTextContent("A day on average · 2 days planned~1,253 kcal~ EstimatedProtein ~52g · Carbs ~150g · Fat ~46g");
    expect(average).toHaveTextContent(/Protein \d+%Carbs \d+%Fat \d+%/);

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      "Mon · 1 meal67229g83g23g",
      "Tue · 2 meals~1,833~75g~217g~69g",
      ...["Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => `${day}Nothing planned`),
    ]);
    expect(screen.getByText("~ Tue includes a recipe with estimated nutrition: Char siu Tofoo noodles.")).toBeInTheDocument();
  });

  it("is a 404 for another household's plan", async () => {
    const theirs = await createPlan(h.b, thisWeek);
    await expect(NutritionPage({ params: Promise.resolve({ id: theirs }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows the current plan's kcal a day each on the plan list (A)", async () => {
    await createPlan(h.a, { ...thisWeek, name: "Half term", startDate: "2026-10-19" });
    render(await PlansPage());
    expect(screen.getByRole("link", { name: /This week/ })).toHaveTextContent("3 meals · ~1,253 kcal a day each");
    expect(screen.getByRole("link", { name: /Half term/ })).not.toHaveTextContent("kcal");
  });
});

describe("leftovers (PP-180)", () => {
  const dayCard = (dayIndex: number) => document.getElementById(`day-${dayIndex}`)!;
  // Tuna pasta serves 4; 2 people at 1 each leave 2.
  let id: string;
  let cook: string;

  beforeEach(async () => {
    id = await createPlan(h.a, thisWeek);
    cook = (await addEntry(h.a, id, { dayIndex: 0, slot: "dinner", recipeId: tuna }))!;
  });

  it("tags leftovers meals and says where a cook's leftovers go (A)", async () => {
    const last = await createPlan(h.a, { ...thisWeek, name: "Last week", startDate: "2026-10-05" });
    const old = (await addEntry(h.a, last, { dayIndex: 5, slot: "dinner", recipeId: tuna }))!;
    await addLeftovers(h.a, id, { dayIndex: 0, slot: "lunch", cookId: old });
    await addLeftovers(h.a, id, { dayIndex: 2, slot: "lunch", cookId: cook, portionsPerPerson: 0.5 });
    await openPlan(id);

    const [lunch, dinner] = within(dayCard(0)).getAllByRole("button", { name: /Lemony tuna/ });
    expect(lunch).toHaveTextContent("1 each · 672 kcal · 29g protein" + "Leftovers from Sat 10 dinner");
    expect(dinner).toHaveTextContent("1 for Wed lunch" + "1 left over");
    expect(within(dayCard(2)).getByRole("button", { name: /Lemony tuna/ })).toHaveTextContent(
      "Leftovers from Mon dinner",
    );
  });

  it("shows leftovers planned past what's left when the plan's people go up", async () => {
    await addLeftovers(h.a, id, { dayIndex: 2, slot: "lunch", cookId: cook });
    await openPlan(await updatePlanFor(id, 3));
    expect(within(dayCard(0)).getByRole("button", { name: /Lemony tuna/ })).toHaveTextContent(
      // Serves 4: 3 eat at the cook and 3 more are planned for Wed.
      "3 for Wed lunch" + "2 more planned than left over",
    );
  });

  async function updatePlanFor(planId: string, people: number) {
    await updatePlanAction({}, form({ planId, ...thisWeek, people }));
    return planId;
  }

  it("plans a cook's leftovers from its sheet, after the cook (B, C)", async () => {
    await openPlan(id);
    fireEvent.click(within(dayCard(0)).getByRole("button", { name: /Lemony tuna/ }));
    const sheet = screen.getByRole("dialog", { name: tunaPasta.name });
    expect(sheet).toHaveTextContent("2 servings left overThe recipe makes 4; 2 are eaten at this meal.2 not planned yet");
    fireEvent.click(within(sheet).getByRole("button", { name: "Plan them" }));

    const grid = screen.getByRole("dialog", { name: "Plan the leftovers" });
    expect(grid).toHaveTextContent("Lemony tuna, tomato & caper one-pot pasta · 2 left from Mon dinner");
    expect(within(grid).getByRole("button", { name: "Mon 12 Oct, dinner: cook" })).toBeDisabled();
    expect(within(grid).getByRole("button", { name: "Mon 12 Oct, lunch: nothing planned" })).toBeDisabled();
    expect(within(grid).getByRole("button", { name: "Mon 12 Oct, snack: nothing planned" })).toBeEnabled();
    expect(grid).toHaveTextContent("2 × 1 = 2, all that's left");
    fireEvent.click(within(grid).getByRole("button", { name: "Fewer portions each" }));
    expect(grid).toHaveTextContent("2 × ½ = 1 · 1 still left");

    fireEvent.click(within(grid).getByRole("button", { name: "Fri 16 Oct, lunch: nothing planned" }));
    await act(async () => fireEvent.click(within(grid).getByRole("button", { name: "Add to Fri lunch" })));
    await waitFor(() => expect(screen.getByText("Added to Fri lunch")).toBeInTheDocument());
    expect((await getPlan(h.a, id))!.entries).toMatchObject([
      { id: cook, leftoversTo: [{ dayIndex: 4, slot: "lunch", servings: 1 }] },
      { dayIndex: 4, slot: "lunch", portionsPerPerson: 0.5, leftoversOf: { entryId: cook } },
    ]);
  });

  it("offers next week's plan for leftovers too (C)", async () => {
    await createPlan(h.a, { ...thisWeek, name: "Next week", startDate: "2026-10-19" });
    await openPlan(id);
    fireEvent.click(within(dayCard(0)).getByRole("button", { name: /Lemony tuna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Plan them" }));
    const grid = screen.getByRole("dialog", { name: "Plan the leftovers" });
    fireEvent.click(within(grid).getByRole("button", { name: /This week/ }));
    expect(within(within(grid).getByRole("list", { name: "Plans" })).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("This week"),
      expect.stringContaining("Next week"),
    ]);
  });

  it("caps a leftovers meal at what's left, and links back to its cook (E)", async () => {
    await addLeftovers(h.a, id, { dayIndex: 2, slot: "lunch", cookId: cook });
    await openPlan(id);
    fireEvent.click(within(dayCard(2)).getByRole("button", { name: /Lemony tuna/ }));
    const sheet = screen.getByRole("dialog", { name: tunaPasta.name });
    expect(sheet).toHaveTextContent("Wed 14 Oct · Lunch");
    expect(sheet).toHaveTextContent("2 people × 1 = 2, all that's left");
    expect(within(sheet).getByRole("button", { name: "More portions each" })).toBeDisabled();
    expect(sheet).not.toHaveTextContent("left over");

    fireEvent.click(within(sheet).getByRole("button", { name: "Leftovers from Mon 12 dinner" }));
    expect(screen.getByRole("dialog", { name: tunaPasta.name })).toHaveTextContent("Mon 12 Oct · Dinner");
    expect(screen.getByRole("dialog", { name: tunaPasta.name })).toHaveTextContent("2 for Wed 14 lunch");
  });

  it("stops a cook's portions where its planned leftovers would be short (B)", async () => {
    await addLeftovers(h.a, id, { dayIndex: 2, slot: "lunch", cookId: cook });
    await openPlan(id);
    fireEvent.click(within(dayCard(0)).getByRole("button", { name: /Lemony tuna/ }));
    const sheet = screen.getByRole("dialog", { name: tunaPasta.name });
    expect(within(sheet).getByRole("button", { name: "More portions each" })).toBeDisabled();
    expect(sheet).toHaveTextContent("2 are planned as leftovers");
  });

  it("asks before removing a cook whose leftovers are planned, then removes both (L)", async () => {
    await addLeftovers(h.a, id, { dayIndex: 2, slot: "lunch", cookId: cook });
    await openPlan(id);
    fireEvent.click(within(dayCard(0)).getByRole("button", { name: /Lemony tuna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    const confirm = screen.getByRole("dialog", { name: "Remove Mon dinner?" });
    expect(confirm).toHaveTextContent(
      "Its leftovers are planned for Wed 14 lunch. Removing the lemony tuna, tomato & caper one-pot pasta removes that too.",
    );
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Remove all" })));
    await waitFor(async () => expect((await getPlan(h.a, id))!.entries).toEqual([]));
  });

  it("removes a leftovers meal with Undo putting it back (E)", async () => {
    await addLeftovers(h.a, id, { dayIndex: 2, slot: "lunch", cookId: cook, portionsPerPerson: 0.5 });
    await openPlan(id);
    fireEvent.click(within(dayCard(2)).getByRole("button", { name: /Lemony tuna/ }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remove" })));
    await waitFor(() => expect(screen.getByText("Removed from Wed lunch")).toBeInTheDocument());
    expect((await getPlan(h.a, id))!.entries).toHaveLength(1);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Undo" })));
    await waitFor(async () =>
      expect((await getPlan(h.a, id))!.entries[1]).toMatchObject({ portionsPerPerson: 0.5, leftoversOf: { entryId: cook } }),
    );
  });

  it("keeps Move from putting leftovers before their cook (E)", async () => {
    await addLeftovers(h.a, id, { dayIndex: 2, slot: "lunch", cookId: cook });
    await openPlan(id);
    fireEvent.click(within(dayCard(2)).getByRole("button", { name: /Lemony tuna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    const sheet = screen.getByRole("dialog", { name: "Move to…" });
    expect(within(sheet).getByRole("button", { name: "Mon 12 Oct, dinner: 1 recipe planned" })).toBeDisabled();
    expect(within(sheet).getByRole("button", { name: "Mon 12 Oct, snack: nothing planned" })).toBeEnabled();
  });

  it("lists leftovers first in the recipe picker, warning when they'll be 2 days old (D)", async () => {
    await openPicker(id, { day: "3", slot: "lunch", meal: "lunch" });
    const section = screen.getByRole("region", { name: "Leftovers" });
    const row = within(section).getByRole("button", { name: /Lemony tuna/ });
    expect(row).toHaveTextContent("2 left · from Mon dinner · 3 days old by Thu");

    await act(async () => fireEvent.click(row));
    await waitFor(() => expect(screen.getByText("Added to Thu lunch")).toBeInTheDocument());
    expect([...mocks.back.mock.calls, ...mocks.replace.mock.calls]).toHaveLength(1);
    expect((await getPlan(h.a, id))!.entries[1]).toMatchObject({ dayIndex: 3, slot: "lunch", leftoversOf: { entryId: cook } });
  });

  it("leaves the Leftovers section out when nothing is waiting yet (D)", async () => {
    await openPicker(id, { day: "0", slot: "lunch", meal: "lunch" });
    expect(screen.queryByRole("region", { name: "Leftovers" })).not.toBeInTheDocument();
  });

  it("warns that deleting a plan removes leftovers planned from it in another plan (L)", async () => {
    const next = await createPlan(h.a, { ...thisWeek, name: "Next week", startDate: "2026-10-19" });
    await addLeftovers(h.a, next, { dayIndex: 0, slot: "lunch", cookId: cook });
    await openPlan(id);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete plan" }));
    expect(screen.getByRole("dialog", { name: 'Delete "This week"?' })).toHaveTextContent(
      "It has 1 meal planned. 1 leftovers meal in another plan eats from it and will go too. The recipes stay in your library.",
    );
  });
});

describe("the freezer (PP-189)", () => {
  const dayCard = (dayIndex: number) => document.getElementById(`day-${dayIndex}`)!;
  // Today is Tue 13 Oct. Tuna pasta serves 4; 2 people at 1 each leave 2.
  let id: string;
  let cook: string;
  const openFreezer = async () => render(<ToastProvider>{await FreezerPage()}</ToastProvider>);

  beforeEach(async () => {
    id = await createPlan(h.a, thisWeek);
    // Wed dinner, still to come.
    cook = (await addEntry(h.a, id, { dayIndex: 2, slot: "dinner", recipeId: tuna }))!;
  });

  it("freezes a cook's leftovers from its sheet, with the recipe's warning (B, F)", async () => {
    await openPlan(id);
    fireEvent.click(within(dayCard(2)).getByRole("button", { name: /Lemony tuna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Freeze" }));
    const sheet = screen.getByRole("dialog", { name: "Freeze the leftovers" });
    expect(sheet).toHaveTextContent("Lemony tuna, tomato & caper one-pot pasta · Wed 14 dinner");
    expect(sheet).toHaveTextContent("They go on the freezer list on Wed 14 Oct, after dinner.");
    // The tuna pasta's file says it doesn't freeze.
    expect(sheet).toHaveTextContent("The recipe says this doesn't freeze wellYou can still freeze it.");
    expect(within(sheet).getByRole("button", { name: "More servings" })).toBeDisabled();
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Freeze 2 servings" })));
    await waitFor(() => expect(screen.getByText("2 servings to freeze")).toBeInTheDocument());
    expect((await getPlan(h.a, id))!.entries[0].frozen).toMatchObject({ servings: 2, frozenOn: "2026-10-14" });
  });

  it("shows what's frozen and meals from the freezer on the plan (A, E)", async () => {
    const item = (await freezeLeftovers(h.a, cook, 2))!;
    await addFromFreezer(h.a, id, { dayIndex: 4, slot: "dinner", itemId: item });
    await openPlan(id);
    expect(within(dayCard(2)).getByRole("button", { name: /Lemony tuna/ })).toHaveTextContent("2 to freeze");
    expect(within(dayCard(4)).getByRole("button", { name: /Lemony tuna/ })).toHaveTextContent("From the freezer");

    fireEvent.click(within(dayCard(4)).getByRole("button", { name: /Lemony tuna/ }));
    const sheet = screen.getByRole("dialog", { name: tunaPasta.name });
    expect(within(sheet).getByRole("link", { name: "From the freezer · frozen 14 Oct" })).toHaveAttribute("href", "/plans/freezer");
    expect(sheet).toHaveTextContent("2 people × 1 = 2, all that's left");
  });

  it("asks before removing a cook whose leftovers are going in the freezer (L)", async () => {
    await freezeLeftovers(h.a, cook, 2);
    await openPlan(id);
    fireEvent.click(within(dayCard(2)).getByRole("button", { name: /Lemony tuna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    const confirm = screen.getByRole("dialog", { name: "Remove Wed dinner?" });
    expect(confirm).toHaveTextContent("2 servings are going in the freezer. Removing the lemony tuna, tomato & caper one-pot pasta removes that too.");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Remove all" })));
    await waitFor(async () => expect(await listFreezer(h.a)).toEqual([]));
  });

  it("lists the freezer in the recipe picker, oldest first, the rest behind Show more (D)", async () => {
    await addToFreezer(h.a, { recipeId: tuna, servings: 4, frozenOn: "2026-09-21" });
    await addToFreezer(h.a, { recipeId: tuna, servings: 2, frozenOn: "2026-10-04" });
    await openPicker(id, { day: "3", slot: "lunch", meal: "lunch" });
    const section = screen.getByRole("region", { name: "In the freezer" });
    expect(within(section).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("4 free · frozen 21 Sep"),
      "Show 1 more",
    ]);
    fireEvent.click(within(section).getByRole("button", { name: "Show 1 more" }));
    expect(within(section).getAllByRole("button", { name: /Lemony tuna/ })).toHaveLength(2);

    await act(async () => fireEvent.click(within(section).getAllByRole("button", { name: /Lemony tuna/ })[0]));
    await waitFor(() => expect(screen.getByText("Added to Thu lunch")).toBeInTheDocument());
    expect((await getPlan(h.a, id))!.entries.find((e) => e.dayIndex === 3)).toMatchObject({ fromFreezer: { frozenOn: "2026-09-21" } });
  });

  it("has a Freezer row on the Plans tab (G)", async () => {
    await addToFreezer(h.a, { recipeId: tuna, servings: 3, frozenOn: "2026-10-04" });
    await freezeLeftovers(h.a, cook, 2);
    render(await PlansPage());
    expect(screen.getByRole("link", { name: /Freezer/ })).toHaveTextContent("Freezer3 servings of 1 recipe · 2 going in Wed");
    expect(screen.getByRole("link", { name: /Freezer/ })).toHaveAttribute("href", "/plans/freezer");
  });

  it("is empty with one action, which adds by hand (J, K)", async () => {
    await openFreezer();
    expect(screen.getByText("Nothing in the freezer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to freezer" }));
    const list = screen.getByRole("dialog", { name: "Add to freezer" });
    fireEvent.change(within(list).getByRole("searchbox", { name: "Search recipes" }), { target: { value: "tuna" } });
    fireEvent.click(within(list).getByRole("button", { name: /Lemony tuna/ }));

    const sheet = screen.getByRole("dialog", { name: "Add to freezer" });
    expect(sheet).toHaveTextContent("The recipe makes 4");
    expect(within(sheet).getByLabelText("Frozen on")).toHaveValue("2026-10-13");
    fireEvent.click(within(sheet).getByRole("button", { name: "Fewer servings" }));
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Add 3½ servings" })));
    await waitFor(() => expect(screen.getByText("3½ servings added to the freezer")).toBeInTheDocument());
    expect(await listFreezer(h.a)).toMatchObject([{ inFreezer: 3.5, frozenOn: "2026-10-13" }]);
  });

  it("lists what's in, oldest first, and what's going in (H)", async () => {
    const item = (await addToFreezer(h.a, { recipeId: tuna, servings: 4, frozenOn: "2026-09-21" }))!;
    await addFromFreezer(h.a, id, { dayIndex: 3, slot: "dinner", itemId: item });
    await freezeLeftovers(h.a, cook, 2);
    await openFreezer();
    expect(screen.getByText("4 servings of 1 recipe · 2 going in Wed")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "In the freezer" })).getByRole("button")).toHaveTextContent(
      "Frozen 21 Sep · 3 weeks ago" + "2 for Thu 15 dinner" + "4servings",
    );
    expect(within(screen.getByRole("region", { name: "Going in" })).getByRole("button")).toHaveTextContent(
      "Wed 14 Oct · from This week's dinner" + "2servings",
    );
  });

  it("corrects the count, not below what's planned, and takes it all out after asking (I)", async () => {
    const item = (await addToFreezer(h.a, { recipeId: tuna, servings: 4, frozenOn: "2026-09-21" }))!;
    await addFromFreezer(h.a, id, { dayIndex: 3, slot: "dinner", itemId: item });
    await openFreezer();
    fireEvent.click(within(screen.getByRole("list", { name: "In the freezer" })).getByRole("button"));
    const sheet = screen.getByRole("dialog", { name: tunaPasta.name });
    expect(sheet).toHaveTextContent("2 planned, so not below that");
    // In halves, from 4 down to the 2 planned.
    for (let i = 0; i < 4; i++) {
      await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Fewer in the freezer" })));
    }
    expect(within(sheet).getByRole("button", { name: "Fewer in the freezer" })).toBeDisabled();
    await waitFor(async () => expect((await listFreezer(h.a))[0].inFreezer).toBe(2));

    fireEvent.click(within(sheet).getByRole("button", { name: "Take it all out" }));
    const confirm = screen.getByRole("dialog", { name: "Take it all out?" });
    expect(confirm).toHaveTextContent("2 servings are planned for Thu 15 dinner. Those meals will be cooked instead.");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Take it all out" })));
    await waitFor(async () => expect(await listFreezer(h.a)).toEqual([]));
    expect((await getPlan(h.a, id))!.entries.find((e) => e.dayIndex === 3)?.fromFreezer).toBeNull();
  });

  it("takes something out with Undo putting it back (I)", async () => {
    await addToFreezer(h.a, { recipeId: tuna, servings: 3, frozenOn: "2026-10-04" });
    await openFreezer();
    fireEvent.click(within(screen.getByRole("list", { name: "In the freezer" })).getByRole("button"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Take it all out" })));
    await waitFor(() => expect(screen.getByText(`${tunaPasta.name} taken out`)).toBeInTheDocument());
    expect(await listFreezer(h.a)).toEqual([]);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Undo" })));
    await waitFor(async () => expect(await listFreezer(h.a)).toMatchObject([{ inFreezer: 3, frozenOn: "2026-10-04" }]));
  });

  it("adds to the freezer from a recipe page's menu (J)", async () => {
    render(
      <ToastProvider>
        {await RecipePage({ params: Promise.resolve({ slug: tunaPasta.id }), searchParams: Promise.resolve({}) })}
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to freezer…" }));
    const sheet = screen.getByRole("dialog", { name: "Add to freezer" });
    expect(sheet).toHaveTextContent(tunaPasta.name);
    await act(async () => fireEvent.click(within(sheet).getByRole("button", { name: "Add 4 servings" })));
    await waitFor(async () => expect(await listFreezer(h.a)).toMatchObject([{ inFreezer: 4 }]));
  });

  it("doesn't show another household's freezer", async () => {
    const bRecipe = (await saveRecipe(h.b, tunaPasta)).id;
    await addToFreezer(h.b, { recipeId: bRecipe, servings: 3, frozenOn: "2026-10-04" });
    await openFreezer();
    expect(screen.getByText("Nothing in the freezer")).toBeInTheDocument();
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
    expect(sheet).toHaveTextContent("Serves 4 · 2 people × 1 each = 2 · 2 left over");

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
