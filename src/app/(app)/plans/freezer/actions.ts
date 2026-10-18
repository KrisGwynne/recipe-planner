"use server";

import { revalidatePath } from "next/cache";
import {
  addFromFreezer,
  addToFreezer,
  freezeLeftovers,
  removeFromFreezer,
  requireHousehold,
  setFreezerCount,
  unfreezeLeftovers,
} from "@/data";
import type { Slot } from "@/plans/plan";

// The freezer (PP-189, designs/leftovers.html F to K). Ids come from the
// browser, so they're only looked up within the signed-in household. A
// change to the freezer can change any plan, so every plan page is refreshed.

function changed() {
  revalidatePath("/plans", "layout");
}

/** Freeze a cook's leftovers, or change how many (design F). The freezer item's id, or null. */
export async function freezeLeftoversAction(cookId: string, servings: number): Promise<string | null> {
  const { ctx } = await requireHousehold();
  const id = await freezeLeftovers(ctx, cookId, servings);
  if (id) changed();
  return id;
}

/** Don't freeze a cook's leftovers after all (design F). */
export async function unfreezeLeftoversAction(cookId: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  const done = await unfreezeLeftovers(ctx, cookId);
  if (done) changed();
  return done;
}

/** Add to freezer by hand (design J). */
export async function addToFreezerAction(item: { recipeId: string; servings: number; frozenOn: string }): Promise<string | null> {
  const { ctx } = await requireHousehold();
  const id = await addToFreezer(ctx, item);
  if (id) changed();
  return id;
}

/** Correct what's in a freezer item (design I), saved as it's tapped. */
export async function setFreezerCountAction(itemId: string, servings: number): Promise<boolean> {
  const { ctx } = await requireHousehold();
  const done = await setFreezerCount(ctx, itemId, servings);
  if (done) changed();
  return done;
}

/** Take it all out (design I). */
export async function removeFromFreezerAction(itemId: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  const done = await removeFromFreezer(ctx, itemId);
  if (done) changed();
  return done;
}

/** Plan a meal from the freezer (design D and I). The new entry's id, or null when it isn't allowed. */
export async function addFromFreezerAction(
  planId: string,
  entry: { dayIndex: number; slot: Slot; itemId: string; portionsPerPerson?: number },
): Promise<string | null> {
  const { ctx } = await requireHousehold();
  const id = await addFromFreezer(ctx, planId, entry);
  if (id) changed();
  return id;
}
