import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { createTestDb } from "@/db/test-db";
import { addEntry, createPlan, getPlan, listPlans, saveRecipe } from "@/data";
import { twoHouseholds, type TwoHouseholds } from "@/data/test-fixtures";
import type { Recipe } from "@/types/recipe";

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  user: { id: "kris", name: "Kris", email: "kris@example.com", image: null },
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
}));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/auth", () => ({ requireUser: async () => mocks.user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: PlansPage } = await import("./page");
const { default: PlanPage } = await import("./[id]/page");
const { createPlanAction, copyPlanAction, deletePlanAction, updatePlanAction } = await import("./actions");

const tunaPasta: Recipe = JSON.parse(readFileSync("examples/lemony-tuna-tomato-caper-pasta.json", "utf8"));
const thisWeek = { name: "This week", startDate: "2026-10-12", days: 7, people: 2 };

const form = (fields: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
};
const openPlan = async (id: string) => render(await PlanPage({ params: Promise.resolve({ id }) }));

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
    expect(within(dinner).getByRole("link", { name: /Lemony tuna.*Fish.*1½ each/ })).toHaveAttribute(
      "href",
      "/recipes/lemony-tuna-tomato-caper-pasta",
    );
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
