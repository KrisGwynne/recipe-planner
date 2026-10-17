import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { recipeHouseholdData, recipes } from "@/db/schema";
import { deriveColumns } from "@/recipes/derive";
import type { Recipe } from "@/types/recipe";
import type { HouseholdContext } from "./context";

// A household's recipes (PP-160). Members and owners alike can save and
// delete (handover section 2). Ids and slugs from the client are only looked
// up within ctx.householdId.

/**
 * Creates the recipe, or updates the household's recipe with the same id
 * (slug), re-deriving every column from it. One statement, so two saves of
 * the same slug can't make two rows. The recipe must already be valid
 * against the schema (import checks it, PP-161).
 */
export async function saveRecipe(ctx: HouseholdContext, recipe: Recipe): Promise<{ id: string; created: boolean }> {
  const columns = deriveColumns(recipe);
  const [row] = await getDb()
    .insert(recipes)
    .values({ householdId: ctx.householdId, data: recipe, ...columns, createdBy: ctx.userId, updatedBy: ctx.userId })
    .onConflictDoUpdate({
      target: [recipes.householdId, recipes.slug],
      set: { data: recipe, ...columns, updatedBy: ctx.userId, updatedAt: sql`now()` },
    })
    // xmax is 0 for a row this statement inserted, and set when it updated one.
    .returning({ id: recipes.id, created: sql<boolean>`(xmax = 0)` });
  return row;
}

/** The household's recipe with this row id, or null (also for another household's id). */
export async function getRecipe(ctx: HouseholdContext, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await getDb()
    .select()
    .from(recipes)
    .where(and(eq(recipes.householdId, ctx.householdId), eq(recipes.id, id)));
  return row ?? null;
}

/** The household's recipe with this JSON id (slug), or null. */
export async function getRecipeBySlug(ctx: HouseholdContext, slug: string) {
  const [row] = await getDb()
    .select()
    .from(recipes)
    .where(and(eq(recipes.householdId, ctx.householdId), eq(recipes.slug, slug)));
  return row ?? null;
}

/** The household's recipes with these slugs (for comparing an import with what's saved). */
export async function getRecipesBySlugs(ctx: HouseholdContext, slugs: string[]) {
  if (slugs.length === 0) return [];
  return getDb()
    .select({ id: recipes.id, slug: recipes.slug, data: recipes.data })
    .from(recipes)
    .where(and(eq(recipes.householdId, ctx.householdId), inArray(recipes.slug, slugs)));
}

/** Every recipe file in the household, by slug, for "Download all recipes" (PP-164). */
export async function listRecipeFiles(ctx: HouseholdContext): Promise<Recipe[]> {
  const rows = await getDb()
    .select({ data: recipes.data })
    .from(recipes)
    .where(eq(recipes.householdId, ctx.householdId))
    .orderBy(asc(recipes.slug));
  return rows.map((r) => r.data);
}

/** Every recipe in the household, A to Z, with what cards, filters and search use (not the whole file). */
export async function listRecipes(ctx: HouseholdContext) {
  return getDb()
    .select({
      id: recipes.id,
      slug: recipes.slug,
      name: recipes.name,
      cuisine: recipes.cuisine,
      difficulty: recipes.difficulty,
      serves: recipes.serves,
      totalMins: recipes.totalMins,
      carbs: recipes.carbs,
      proteinType: recipes.proteinType,
      proteinItems: recipes.proteinItems,
      mealType: recipes.mealType,
      dietary: recipes.dietary,
      spiceLevel: recipes.spiceLevel,
      hasVeggieOption: recipes.hasVeggieOption,
      kcal: recipes.kcal,
      proteinG: recipes.proteinG,
      nutritionSource: recipes.nutritionSource,
      sourceKind: recipes.sourceKind,
      sourceTitle: recipes.sourceTitle,
      createdAt: recipes.createdAt,
      // Read from the file for filtering and search (PP-167).
      equipment: sql<string[]>`array(select jsonb_array_elements_text(${recipes.data}->'equipment'))`,
      freezable: sql<boolean | null>`(${recipes.data}->'storage'->>'freezable')::boolean`,
      ingredients: sql<{ item: string; prep: string | null }[]>`coalesce((
        select jsonb_agg(jsonb_build_object('item', i->>'item', 'prep', i->>'prep'))
        from jsonb_array_elements(${recipes.data}->'ingredients') i
      ), '[]'::jsonb)`,
      // The household's own data (PP-169), for the heart, Favourites only and the sorts.
      favourite: sql<boolean>`coalesce(${recipeHouseholdData.favourite}, false)`,
      rating: recipeHouseholdData.rating,
      lastCooked: sql<string | null>`(select max(cooked_on)::text from recipe_cooks c where c.recipe_id = ${recipes.id})`,
    })
    .from(recipes)
    .leftJoin(recipeHouseholdData, eq(recipeHouseholdData.recipeId, recipes.id))
    .where(eq(recipes.householdId, ctx.householdId))
    .orderBy(asc(sql`lower(${recipes.name})`), asc(recipes.name));
}

/** Deletes the household's recipe with this id. False if there's none (or it's another household's). */
export async function deleteRecipe(ctx: HouseholdContext, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const deleted = await getDb()
    .delete(recipes)
    .where(and(eq(recipes.householdId, ctx.householdId), eq(recipes.id, id)))
    .returning({ id: recipes.id });
  return deleted.length > 0;
}

function isUuid(id: string): boolean {
  return z.uuid().safeParse(id).success;
}
