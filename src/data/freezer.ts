import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { MAX_PORTIONS, MIN_PORTIONS, today, type Slot } from "@/plans/plan";
import type { ProteinType } from "@/recipes/derive";
import type { DietaryFlag, Recipe } from "@/types/recipe";
import type { HouseholdContext } from "./context";
import {
  dayIndex,
  freeSql,
  frozenFrom,
  inFreezer,
  inFreezerBy,
  leftSql,
  plannedFromFreezer,
  position,
  rows,
  slot,
  targetPosition,
  uuid,
} from "./plan-sql";

// The household's freezer (PP-189, designs/leftovers.html F to K). A batch
// goes in from a cook's leftovers (one per cook, on the cook's day) or by
// hand, and comes out as meals planned from it pass. What's in it is never
// ticked off: servings planned from it leave once the meal's day has passed,
// and the count can be corrected by hand (Kris, 2026-10-18). Ids from the
// client are only looked up within ctx.householdId.

/** Servings in the freezer go in halves, up to 50 (the add sheet's stepper, design J). */
export const MAX_FROZEN = 50;
const frozenServings = z
  .number()
  .min(MIN_PORTIONS)
  .max(MAX_FROZEN)
  .refine((n) => Number.isInteger(n * 2), "Servings go in halves");
const count = z
  .number()
  .min(0)
  .max(MAX_FROZEN)
  .refine((n) => Number.isInteger(n * 2), "Servings go in halves");

type RecipeFields = {
  id: string;
  slug: string;
  name: string;
  serves: number;
  proteinType: ProteinType;
  dietary: DietaryFlag[];
  kcal: number;
  proteinG: number;
  nutritionSource: "printed" | "estimated";
  storage: Recipe["storage"];
};

type RecipeRow = {
  recipe_id: string;
  slug: string;
  name: string;
  serves: number;
  protein_type: ProteinType;
  dietary: DietaryFlag[];
  kcal: number;
  protein_g: number;
  nutrition_source: "printed" | "estimated";
  storage: Recipe["storage"];
};

const recipeColumns = sql`r.id as recipe_id, r.slug, r.name, r.serves, r.protein_type, r.dietary, r.kcal, r.protein_g,
  r.nutrition_source, r.data->'storage' as storage`;

function toRecipe(row: RecipeRow): RecipeFields {
  return {
    id: row.recipe_id,
    slug: row.slug,
    name: row.name,
    serves: row.serves,
    proteinType: row.protein_type,
    dietary: row.dietary,
    kcal: row.kcal,
    proteinG: row.protein_g,
    nutritionSource: row.nutrition_source,
    storage: row.storage,
  };
}

/** A meal planned to eat from a freezer item, today or later. */
export type FreezerMeal = { entryId: string; planId: string; planName: string; date: string; dayIndex: number; slot: Slot; servings: number };

export type FreezerItem = {
  id: string;
  recipe: RecipeFields;
  frozenOn: string;
  /** Not in yet: frozen from a cook on a day still to come. */
  goingIn: boolean;
  /** What's in the freezer now (or will go in). */
  inFreezer: number;
  /** Meals planned to eat from it, today or later, in date order. */
  planned: FreezerMeal[];
  /** The cook it was frozen from, if any. */
  from: { planId: string; planName: string; date: string; slot: Slot } | null;
};

/**
 * What's in the household's freezer (design H), oldest first: each batch
 * with something left in it, or still to go in.
 */
export async function listFreezer(ctx: HouseholdContext, todayDate: string = today()): Promise<FreezerItem[]> {
  const db = getDb();
  const [items, meals] = await Promise.all([
    db.execute(sql`
      select f.id, to_char(f.frozen_on, 'YYYY-MM-DD') as frozen_on, f.frozen_on > ${todayDate}::date as going_in,
        ${inFreezer("f", todayDate)} as in_freezer, ${recipeColumns},
        c.plan_id as from_plan_id, cp.name as from_plan_name, to_char(cp.start_date + c.day_index, 'YYYY-MM-DD') as from_date,
        c.slot as from_slot
      from freezer_items f
      join recipes r on r.id = f.recipe_id
      left join meal_plan_entries c on c.id = f.from_entry
      left join meal_plans cp on cp.id = c.plan_id
      where f.household_id = ${ctx.householdId}
      order by f.frozen_on, f.created_at
    `),
    db.execute(sql`
      select m.id, m.from_freezer, mp.id as plan_id, mp.name as plan_name,
        to_char(mp.start_date + m.day_index, 'YYYY-MM-DD') as date, m.day_index, m.slot,
        (mp.people * m.portions_per_person)::float8 as servings
      from meal_plan_entries m join meal_plans mp on mp.id = m.plan_id
      where mp.household_id = ${ctx.householdId} and m.from_freezer is not null
        and mp.start_date + m.day_index >= ${todayDate}::date
      order by ${position("m", "mp")}, m.created_at
    `),
  ]);
  type ItemRow = RecipeRow & {
    id: string;
    frozen_on: string;
    going_in: boolean;
    in_freezer: number;
    from_plan_id: string | null;
    from_plan_name: string | null;
    from_date: string | null;
    from_slot: Slot | null;
  };
  type MealRow = { id: string; from_freezer: string; plan_id: string; plan_name: string; date: string; day_index: number; slot: Slot; servings: number };
  const mealRows = rows<MealRow>(meals);
  return rows<ItemRow>(items)
    .filter((row) => row.going_in || row.in_freezer > 0)
    .map((row) => ({
      id: row.id,
      recipe: toRecipe(row),
      frozenOn: row.frozen_on,
      goingIn: row.going_in,
      inFreezer: row.in_freezer,
      planned: mealRows
        .filter((meal) => meal.from_freezer === row.id)
        .map((meal) => ({
          entryId: meal.id,
          planId: meal.plan_id,
          planName: meal.plan_name,
          date: meal.date,
          dayIndex: meal.day_index,
          slot: meal.slot,
          servings: meal.servings,
        })),
      from:
        row.from_plan_id && row.from_plan_name && row.from_date && row.from_slot
          ? { planId: row.from_plan_id, planName: row.from_plan_name, date: row.from_date, slot: row.from_slot }
          : null,
    }));
}

/**
 * Freezes a cook's leftovers (design F): sets how many of its servings go in,
 * on the cook's day. No more than it has left, and no fewer than meals
 * already planned from them. Returns the freezer item's id, or null.
 */
export async function freezeLeftovers(ctx: HouseholdContext, cookId: string, servings: number): Promise<string | null> {
  if (!uuid.safeParse(cookId).success) return null;
  const amount = sql`${frozenServings.parse(servings)}::float8`;
  const result = await getDb().execute(sql`
    with cook as (
      select c.id, c.recipe_id, cp.start_date + c.day_index as day, ${leftSql("c", "cp", "r")} + ${frozenFrom("c")} as room
      from meal_plan_entries c join meal_plans cp on cp.id = c.plan_id join recipes r on r.id = c.recipe_id
      where c.id = ${cookId} and cp.household_id = ${ctx.householdId} and c.leftovers_of is null and c.from_freezer is null
    )
    insert into freezer_items (household_id, recipe_id, servings, frozen_on, from_entry, created_by)
    select ${ctx.householdId}, cook.recipe_id, ${amount}, cook.day, cook.id, ${ctx.userId} from cook where ${amount} <= cook.room
    on conflict (from_entry) do update set servings = excluded.servings
      where ${freeSql("freezer_items")} - freezer_items.servings + excluded.servings >= 0
    returning id
  `);
  return rows<{ id: string }>(result)[0]?.id ?? null;
}

/** Undoes freezing a cook's leftovers (design B and F). False if meals are planned from them, or there's nothing to undo. */
export async function unfreezeLeftovers(ctx: HouseholdContext, cookId: string): Promise<boolean> {
  if (!uuid.safeParse(cookId).success) return false;
  const result = await getDb().execute(sql`
    delete from freezer_items f
    where f.from_entry = ${cookId} and f.household_id = ${ctx.householdId}
      and not exists (select 1 from meal_plan_entries m where m.from_freezer = f.id)
    returning f.id
  `);
  return rows(result).length > 0;
}

/** Adds servings of a recipe to the freezer by hand (design J), frozen today or earlier. The new item's id, or null. */
export async function addToFreezer(
  ctx: HouseholdContext,
  item: { recipeId: string; servings: number; frozenOn: string },
  todayDate: string = today(),
): Promise<string | null> {
  if (!uuid.safeParse(item.recipeId).success) return null;
  const amount = frozenServings.parse(item.servings);
  const frozenOn = z.iso.date().parse(item.frozenOn);
  if (frozenOn > todayDate) return null;
  const result = await getDb().execute(sql`
    insert into freezer_items (household_id, recipe_id, servings, frozen_on, created_by)
    select ${ctx.householdId}, r.id, ${amount}::float8, ${frozenOn}::date, ${ctx.userId}
    from recipes r where r.id = ${item.recipeId} and r.household_id = ${ctx.householdId}
    returning id
  `);
  return rows<{ id: string }>(result)[0]?.id ?? null;
}

/**
 * Corrects what's in a freezer item now (design I): eaten outside a plan,
 * thrown away, or more than it says. Not below what's planned from it.
 * False if that isn't allowed or there's no such item in the household.
 */
export async function setFreezerCount(
  ctx: HouseholdContext,
  itemId: string,
  servings: number,
  todayDate: string = today(),
): Promise<boolean> {
  if (!uuid.safeParse(itemId).success) return false;
  const amount = sql`${count.parse(servings)}::float8`;
  const result = await getDb().execute(sql`
    update freezer_items f set adjustment = f.adjustment + (${amount} - ${inFreezer("f", todayDate)})
    where f.id = ${itemId} and f.household_id = ${ctx.householdId}
      and ${amount} >= ${plannedFromFreezer("f", todayDate)}
    returning f.id
  `);
  return rows(result).length > 0;
}

/**
 * Takes a batch out of the freezer altogether (design I's "Take it all
 * out"); meals planned from it become ordinary cooks (the sheet asks first).
 * False if there's no such item in the household.
 */
export async function removeFromFreezer(ctx: HouseholdContext, itemId: string): Promise<boolean> {
  if (!uuid.safeParse(itemId).success) return false;
  const result = await getDb().execute(sql`
    delete from freezer_items where id = ${itemId} and household_id = ${ctx.householdId} returning id
  `);
  return rows(result).length > 0;
}

/**
 * Plans a meal from the freezer (design D and I): the item must be the
 * household's, in the freezer by the meal, with enough free for the plan's
 * people × portions each, which default to 1 or less (½ at least). Returns
 * the new entry's id, or null.
 */
export async function addFromFreezer(
  ctx: HouseholdContext,
  planId: string,
  entry: { dayIndex: number; slot: Slot; itemId: string; portionsPerPerson?: number },
): Promise<string | null> {
  if (!uuid.safeParse(planId).success || !uuid.safeParse(entry.itemId).success) return null;
  const day = dayIndex.parse(entry.dayIndex);
  const meal = slot.parse(entry.slot);
  const amount = entry.portionsPerPerson === undefined ? null : entry.portionsPerPerson;
  if (amount !== null && !(amount >= MIN_PORTIONS && amount <= MAX_PORTIONS && Number.isInteger(amount * 2))) return null;
  const result = await getDb().execute(sql`
    insert into meal_plan_entries (plan_id, day_index, slot, recipe_id, portions_per_person, from_freezer)
    select p.id, ${day}, ${meal}, f.recipe_id, x.amount, f.id
    from meal_plans p
    join freezer_items f on f.id = ${entry.itemId} and f.household_id = p.household_id
    cross join lateral (select ${freeSql("f")} as free) rest
    cross join lateral (select coalesce(${amount}::float8, least(1, floor(rest.free * 2 / p.people) / 2)) as amount) x
    where p.id = ${planId} and p.household_id = ${ctx.householdId} and ${day} < p.days
      and ${inFreezerBy("f", targetPosition("p", day, meal))}
      and x.amount >= ${MIN_PORTIONS}::float8 and x.amount <= ${MAX_PORTIONS}::float8
      and p.people * x.amount <= rest.free
    returning id
  `);
  return rows<{ id: string }>(result)[0]?.id ?? null;
}

export type AvailableFromFreezer = { itemId: string; frozenOn: string; free: number; recipe: RecipeFields };

/**
 * What the freezer has for a meal (design D): in it by then, with enough
 * free for everyone to have ½, oldest first.
 */
export async function availableFromFreezer(
  ctx: HouseholdContext,
  planId: string,
  at: { dayIndex: number; slot: Slot },
): Promise<AvailableFromFreezer[]> {
  if (!uuid.safeParse(planId).success) return [];
  const day = dayIndex.parse(at.dayIndex);
  const meal = slot.parse(at.slot);
  const result = await getDb().execute(sql`
    select f.id, to_char(f.frozen_on, 'YYYY-MM-DD') as frozen_on, rest.free, ${recipeColumns}
    from meal_plans p
    join freezer_items f on f.household_id = p.household_id
    join recipes r on r.id = f.recipe_id
    cross join lateral (select ${freeSql("f")} as free) rest
    where p.id = ${planId} and p.household_id = ${ctx.householdId}
      and ${inFreezerBy("f", targetPosition("p", day, meal))}
      and rest.free >= p.people * ${MIN_PORTIONS}::float8
    order by f.frozen_on, f.created_at
  `);
  return rows<RecipeRow & { id: string; frozen_on: string; free: number }>(result).map((row) => ({
    itemId: row.id,
    frozenOn: row.frozen_on,
    free: row.free,
    recipe: toRecipe(row),
  }));
}
