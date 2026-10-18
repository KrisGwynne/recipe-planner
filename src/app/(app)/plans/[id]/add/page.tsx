import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { availableFromFreezer, availableLeftovers, getPlan, listRecipes, requireHousehold } from "@/data";
import { SLOTS, mealName, type Slot } from "@/plans/plan";
import { RecipePicker } from "./recipe-picker";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "Add a recipe" };

/**
 * Choosing a recipe for a day and meal (meal plans design E):
 * /plans/<id>/add?day=2&slot=lunch. The plan is found within the household,
 * and a day outside it or an unknown meal is a 404. Leftovers waiting to be
 * eaten come first (leftovers design D).
 */
export default async function AddRecipePage({ params, searchParams }: Props) {
  const { ctx } = await requireHousehold();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [plan, recipes] = await Promise.all([getPlan(ctx, id), listRecipes(ctx)]);
  if (!plan) notFound();

  const dayIndex = Number(query.day);
  const slot = query.slot;
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= plan.days) notFound();
  if (typeof slot !== "string" || !(SLOTS as readonly string[]).includes(slot)) notFound();

  const at = { dayIndex, slot: slot as Slot };
  const [leftovers, freezer] = await Promise.all([availableLeftovers(ctx, plan.id, at), availableFromFreezer(ctx, plan.id, at)]);

  // "In this plan: Thu dinner" on each recipe already planned.
  const inPlan: Record<string, string[]> = {};
  for (const entry of plan.entries) {
    const where = mealName(plan, entry.dayIndex, entry.slot);
    const list = (inPlan[entry.recipe.id] ??= []);
    if (!list.includes(where)) list.push(where);
  }

  return (
    <RecipePicker
      plan={{ id: plan.id, name: plan.name, startDate: plan.startDate, people: plan.people }}
      dayIndex={dayIndex}
      slot={slot as Slot}
      recipes={recipes}
      inPlan={inPlan}
      leftovers={leftovers}
      freezer={freezer}
    />
  );
}
