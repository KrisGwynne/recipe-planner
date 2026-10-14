"use server";

import { revalidatePath } from "next/cache";
import { markCooked, requireHousehold, setFavourite, setNotes, setRating, unmarkCooked } from "@/data";
import { today } from "@/plans/plan";

// The household's favourite, rating, notes and "Cooked today" (PP-169), from
// the library and the recipe page. Recipe ids come from the browser, so
// they're only looked up within the signed-in household. Anything invalid is
// refused (false), not thrown.

/** The library and every recipe page show this data. */
function changed() {
  revalidatePath("/recipes", "layout");
}

async function attempt(change: () => Promise<boolean>): Promise<boolean> {
  let done: boolean;
  try {
    done = await change();
  } catch {
    return false;
  }
  if (done) changed();
  return done;
}

export async function setFavouriteAction(recipeId: string, favourite: boolean): Promise<boolean> {
  const { ctx } = await requireHousehold();
  return attempt(() => setFavourite(ctx, recipeId, favourite));
}

export async function setRatingAction(recipeId: string, rating: number | null): Promise<boolean> {
  const { ctx } = await requireHousehold();
  return attempt(() => setRating(ctx, recipeId, rating));
}

export async function setNotesAction(recipeId: string, notes: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  return attempt(() => setNotes(ctx, recipeId, notes));
}

/** Marks the recipe cooked today (in the UK). Returns the day, for Undo, or null. */
export async function markCookedAction(recipeId: string): Promise<string | null> {
  const { ctx } = await requireHousehold();
  const day = today();
  return (await attempt(() => markCooked(ctx, recipeId, day))) ? day : null;
}

export async function unmarkCookedAction(recipeId: string, day: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  return attempt(() => unmarkCooked(ctx, recipeId, day));
}
