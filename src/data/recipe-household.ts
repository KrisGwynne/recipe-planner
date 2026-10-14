import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { recipeCooks, recipeHouseholdData, recipes, users } from "@/db/schema";
import { MAX_NOTES } from "@/recipes/household";
import type { HouseholdContext } from "./context";

// The household's favourite, rating, notes and cooking history for a recipe
// (PP-169). Shared by everyone in the household; anyone can change them.
// Recipe ids from the client are only found within ctx.householdId, so
// another household's recipe is never read or written.

const uuid = z.uuid();
const ratingInput = z.number().int().min(1).max(5).nullable();
const notesInput = z.string().trim().max(MAX_NOTES);
const day = z.iso.date();

function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

export type RecipeHousehold = {
  favourite: boolean;
  rating: number | null;
  notes: { text: string; editedBy: string | null; editedAt: Date } | null;
  /** Days it was cooked (YYYY-MM-DD), most recent first. */
  cooked: string[];
};

/** The household's data for its recipe, or null if the recipe isn't the household's. */
export async function getRecipeHousehold(ctx: HouseholdContext, recipeId: string): Promise<RecipeHousehold | null> {
  if (!uuid.safeParse(recipeId).success) return null;
  const db = getDb();
  const [row] = await db
    .select({
      favourite: recipeHouseholdData.favourite,
      rating: recipeHouseholdData.rating,
      notes: recipeHouseholdData.notes,
      editedBy: users.name,
      editedAt: recipeHouseholdData.notesUpdatedAt,
    })
    .from(recipes)
    .leftJoin(recipeHouseholdData, eq(recipeHouseholdData.recipeId, recipes.id))
    .leftJoin(users, eq(users.id, recipeHouseholdData.notesUpdatedBy))
    .where(sql`${recipes.id} = ${recipeId} and ${recipes.householdId} = ${ctx.householdId}`);
  if (!row) return null;
  const cooked = await db
    .select({ cookedOn: recipeCooks.cookedOn })
    .from(recipeCooks)
    .where(eq(recipeCooks.recipeId, recipeId))
    .orderBy(desc(recipeCooks.cookedOn));
  return {
    favourite: row.favourite ?? false,
    rating: row.rating,
    notes: row.notes && row.editedAt ? { text: row.notes, editedBy: row.editedBy, editedAt: row.editedAt } : null,
    cooked: cooked.map((c) => c.cookedOn),
  };
}

/**
 * Sets columns on the recipe's row, making it if it's the first thing set.
 * The insert only selects the household's own recipe, so the update can't
 * reach another household's row. False if the recipe isn't the household's.
 */
async function upsert(ctx: HouseholdContext, recipeId: string, values: Record<string, unknown>): Promise<boolean> {
  if (!uuid.safeParse(recipeId).success) return false;
  const columns = Object.keys(values);
  const result = await getDb().execute(sql`
    insert into recipe_household_data (recipe_id, ${sql.join(columns.map((c) => sql.identifier(c)), sql`, `)})
    select r.id, ${sql.join(columns.map((c) => sql`${values[c]}`), sql`, `)}
    from recipes r
    where r.id = ${recipeId} and r.household_id = ${ctx.householdId}
    on conflict (recipe_id) do update set ${sql.join(
      columns.map((c) => sql`${sql.identifier(c)} = excluded.${sql.identifier(c)}`),
      sql`, `,
    )}
    returning recipe_id
  `);
  return rows(result).length > 0;
}

/** Favourites or unfavourites the household's recipe. False if it isn't the household's. */
export async function setFavourite(ctx: HouseholdContext, recipeId: string, favourite: boolean): Promise<boolean> {
  return upsert(ctx, recipeId, { favourite: z.boolean().parse(favourite) });
}

/** Rates the household's recipe 1 to 5, or clears the rating with null. */
export async function setRating(ctx: HouseholdContext, recipeId: string, rating: number | null): Promise<boolean> {
  return upsert(ctx, recipeId, { rating: ratingInput.parse(rating) });
}

/**
 * Saves "Our notes", trimmed, as edited by the signed-in user now. Empty
 * notes are deleted. Throws if they're longer than MAX_NOTES.
 */
export async function setNotes(ctx: HouseholdContext, recipeId: string, notes: string): Promise<boolean> {
  const text = notesInput.parse(notes);
  return text
    ? upsert(ctx, recipeId, { notes: text, notes_updated_by: ctx.userId, notes_updated_at: sql`now()` })
    : upsert(ctx, recipeId, { notes: null, notes_updated_by: null, notes_updated_at: null });
}

/** Records that the household cooked its recipe on this day; once a day. False if it isn't the household's. */
export async function markCooked(ctx: HouseholdContext, recipeId: string, on: string): Promise<boolean> {
  if (!uuid.safeParse(recipeId).success) return false;
  const cookedOn = day.parse(on);
  const [recipe] = await getDb()
    .select({ id: recipes.id })
    .from(recipes)
    .where(sql`${recipes.id} = ${recipeId} and ${recipes.householdId} = ${ctx.householdId}`);
  if (!recipe) return false;
  await getDb()
    .insert(recipeCooks)
    .values({ recipeId, cookedOn, cookedBy: ctx.userId })
    .onConflictDoNothing({ target: [recipeCooks.recipeId, recipeCooks.cookedOn] });
  return true;
}

/** Takes a day out of the household's recipe's history (Undo). False if there was nothing to remove. */
export async function unmarkCooked(ctx: HouseholdContext, recipeId: string, on: string): Promise<boolean> {
  if (!uuid.safeParse(recipeId).success) return false;
  const cookedOn = day.parse(on);
  const result = await getDb().execute(sql`
    delete from recipe_cooks c using recipes r
    where c.recipe_id = ${recipeId} and c.cooked_on = ${cookedOn}
      and r.id = c.recipe_id and r.household_id = ${ctx.householdId}
    returning c.id
  `);
  return rows(result).length > 0;
}
