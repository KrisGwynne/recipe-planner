"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copyPlan, createPlan, deletePlan, requireHousehold, updatePlan } from "@/data";
import { planInput, type PlanInput } from "@/plans/plan";

// The plan sheets (meal plans design C, J, K and L). The plan id comes from
// the form, so it's only looked up within the signed-in household.

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
