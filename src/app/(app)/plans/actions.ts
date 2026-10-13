"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addEntry,
  copyPlan,
  createPlan,
  deletePlan,
  getPlan,
  moveEntry,
  removeEntry,
  requireHousehold,
  setEntryPortions,
  updatePlan,
} from "@/data";
import { planInput, type PlanInput, type Slot } from "@/plans/plan";
import { toPlanGrid, type PlanGrid } from "@/plans/plan-grid";

// The plan sheets (meal plans design C, J, K and L) and filling a plan (E, F,
// G). Plan, entry and recipe ids come from the browser, so they're only looked
// up within the signed-in household.

export type PlanFormState = {
  errors?: { name?: string; startDate?: string; form?: string };
  /** Set when an edit has been saved, so the sheet can close. */
  saved?: boolean;
};

type Parsed = { input: PlanInput; state?: undefined } | { input?: undefined; state: PlanFormState };

function parse(formData: FormData): Parsed {
  const parsed = planInput.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    days: formData.get("days"),
    people: formData.get("people"),
  });
  if (parsed.success) return { input: parsed.data };
  const errors: PlanFormState["errors"] = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "name" || field === "startDate") errors[field] ??= issue.message;
    else errors.form ??= "Check the days and people";
  }
  return { state: { errors } };
}

const gone: PlanFormState = { errors: { form: "That plan no longer exists" } };

/** New plan (design C): makes it and opens it. */
export async function createPlanAction(_previous: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const { ctx } = await requireHousehold();
  const { input, state } = parse(formData);
  if (state) return state;
  const id = await createPlan(ctx, input);
  revalidatePath("/plans");
  redirect(`/plans/${id}`);
}

/** Copy to a new plan (design J): the copy opens. */
export async function copyPlanAction(_previous: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const { ctx } = await requireHousehold();
  const { input, state } = parse(formData);
  if (state) return state;
  const id = await copyPlan(ctx, String(formData.get("planId")), input);
  if (!id) return gone;
  revalidatePath("/plans");
  redirect(`/plans/${id}`);
}

/** Edit plan (design K). */
export async function updatePlanAction(_previous: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const { ctx } = await requireHousehold();
  const { input, state } = parse(formData);
  if (state) return state;
  const id = String(formData.get("planId"));
  if (!(await updatePlan(ctx, id, input))) return gone;
  revalidatePath("/plans");
  revalidatePath(`/plans/${id}`);
  return { saved: true };
}

/** Delete plan (design L): back to the plan list. */
export async function deletePlanAction(planId: string): Promise<void> {
  const { ctx } = await requireHousehold();
  await deletePlan(ctx, planId);
  revalidatePath("/plans");
  redirect("/plans");
}

function changed(planId: string) {
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
}

/** Adds a recipe to a day and meal (design E and G), 1 portion each unless given. The new entry's id, or null. */
export async function addEntryAction(
  planId: string,
  entry: { dayIndex: number; slot: Slot; recipeId: string; portionsPerPerson?: number },
): Promise<string | null> {
  const { ctx } = await requireHousehold();
  const id = await addEntry(ctx, planId, entry);
  if (id) changed(planId);
  return id;
}

/** Portions each, saved as they're tapped (design F). */
export async function setPortionsAction(planId: string, entryId: string, portionsPerPerson: number): Promise<boolean> {
  const { ctx } = await requireHousehold();
  const done = await setEntryPortions(ctx, entryId, portionsPerPerson);
  if (done) changed(planId);
  return done;
}

/** "Move to…" (design G from F). */
export async function moveEntryAction(planId: string, entryId: string, to: { dayIndex: number; slot: Slot }): Promise<boolean> {
  const { ctx } = await requireHousehold();
  const done = await moveEntry(ctx, entryId, to);
  if (done) changed(planId);
  return done;
}

/** Remove (design F); Undo adds it back. */
export async function removeEntryAction(planId: string, entryId: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  const done = await removeEntry(ctx, entryId);
  if (done) changed(planId);
  return done;
}

/** A plan's day-and-meal grid, for "Add to plan" when another plan is chosen (design G). */
export async function planGridAction(planId: string): Promise<PlanGrid | null> {
  const { ctx } = await requireHousehold();
  const plan = await getPlan(ctx, planId);
  return plan ? toPlanGrid(plan) : null;
}
