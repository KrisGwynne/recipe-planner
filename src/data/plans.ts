import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { mealPlanEntries, mealPlans, recipes } from "@/db/schema";
import { MAX_DAYS, SLOTS, planInput, portions, type PlanInput, type Slot } from "@/plans/plan";
import type { HouseholdContext } from "./context";

// A household's meal plans and their entries (PP-170). Anyone in the
// household can make, change and delete plans (meal plans design). Plan,
// entry and recipe ids from the client are only looked up within
// ctx.householdId. The Neon HTTP driver has no transactions, so changes that
// touch both tables are single statements.

const uuid = z.uuid();
const dayIndex = z.number().int().min(0).max(MAX_DAYS - 1);
const slot = z.enum(SLOTS);

function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

const planColumns = {
  id: mealPlans.id,
  name: mealPlans.name,
  startDate: mealPlans.startDate,
  days: mealPlans.days,
  people: mealPlans.people,
};

/**
 * Every plan in the household, for the plan list: how many meals each day has
 * planned, and each person's kcal a day on average over the days planned
 * (null with nothing planned).
 */
export async function listPlans(ctx: HouseholdContext) {
  const db = getDb();
  const [plans, counts] = await Promise.all([
    db
      .select(planColumns)
      .from(mealPlans)
      .where(eq(mealPlans.householdId, ctx.householdId))
      .orderBy(asc(mealPlans.startDate), asc(mealPlans.createdAt)),
    db
      .select({
        planId: mealPlanEntries.planId,
        dayIndex: mealPlanEntries.dayIndex,
        // A meal with a curry and a side is one meal.
        meals: sql<number>`count(distinct ${mealPlanEntries.slot})::int`,
        // Each person's kcal that day (PP-172), and whether any of it is estimated.
        kcal: sql<number>`sum(${recipes.kcal} * ${mealPlanEntries.portionsPerPerson})::float8`,
        estimated: sql<boolean>`bool_or(${recipes.nutritionSource} = 'estimated')`,
      })
      .from(mealPlanEntries)
      .innerJoin(mealPlans, eq(mealPlans.id, mealPlanEntries.planId))
      .innerJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
      .where(eq(mealPlans.householdId, ctx.householdId))
      .groupBy(mealPlanEntries.planId, mealPlanEntries.dayIndex),
  ]);
  return plans.map((plan) => {
    const mealsByDay = Array.from({ length: plan.days }, () => 0);
    let kcal = 0;
    let estimated = false;
    let daysPlanned = 0;
    for (const count of counts) {
      if (count.planId === plan.id && count.dayIndex < plan.days) {
        mealsByDay[count.dayIndex] = count.meals;
        kcal += count.kcal;
        estimated ||= count.estimated;
        daysPlanned++;
      }
    }
    const averageKcal = daysPlanned === 0 ? null : { kcal: kcal / daysPlanned, estimated };
    return { ...plan, mealsByDay, averageKcal };
  });
}

export type PlanSummary = Awaited<ReturnType<typeof listPlans>>[number];

/** The household's plan with this id and its entries (day, then meal, then the order added), or null. */
export async function getPlan(ctx: HouseholdContext, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const db = getDb();
  const [plan] = await db
    .select(planColumns)
    .from(mealPlans)
    .where(and(eq(mealPlans.householdId, ctx.householdId), eq(mealPlans.id, id)));
  if (!plan) return null;
  const entries = await db
    .select({
      id: mealPlanEntries.id,
      dayIndex: mealPlanEntries.dayIndex,
      slot: mealPlanEntries.slot,
      portionsPerPerson: mealPlanEntries.portionsPerPerson,
      recipe: {
        id: recipes.id,
        slug: recipes.slug,
        name: recipes.name,
        serves: recipes.serves,
        proteinType: recipes.proteinType,
        dietary: recipes.dietary,
        kcal: recipes.kcal,
        proteinG: recipes.proteinG,
        carbsG: recipes.carbsG,
        fatG: recipes.fatG,
        nutritionSource: recipes.nutritionSource,
      },
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(eq(mealPlanEntries.planId, plan.id))
    .orderBy(
      asc(mealPlanEntries.dayIndex),
      asc(sql`array_position(array['breakfast','lunch','dinner','snack'], ${mealPlanEntries.slot})`),
      asc(mealPlanEntries.createdAt),
      asc(mealPlanEntries.id),
    );
  return { ...plan, entries };
}

export type Plan = NonNullable<Awaited<ReturnType<typeof getPlan>>>;
export type PlanEntry = Plan["entries"][number];

/** Makes a plan; returns its id. */
export async function createPlan(ctx: HouseholdContext, input: PlanInput): Promise<string> {
  const { name, startDate, days, people } = planInput.parse(input);
  const [row] = await getDb()
    .insert(mealPlans)
    .values({ householdId: ctx.householdId, name, startDate, days, people, createdBy: ctx.userId })
    .returning({ id: mealPlans.id });
  return row.id;
}

/**
 * Changes a plan's name, dates or people. Entries are stored by day number,
 * so a new start date moves them with it; fewer days removes the entries on
 * the days cut off (the edit sheet warns first). Null if there's no such plan.
 */
export async function updatePlan(
  ctx: HouseholdContext,
  id: string,
  input: PlanInput,
): Promise<{ removedEntries: number } | null> {
  if (!uuid.safeParse(id).success) return null;
  const { name, startDate, days, people } = planInput.parse(input);
  const result = await getDb().execute(sql`
    with updated as (
      update meal_plans
      set name = ${name}, start_date = ${startDate}, days = ${days}, people = ${people}, updated_at = now()
      where id = ${id} and household_id = ${ctx.householdId}
      returning id, days
    ), removed as (
      delete from meal_plan_entries e using updated u
      where e.plan_id = u.id and e.day_index >= u.days
      returning e.id
    )
    select (select count(*) from updated)::int as updated, (select count(*) from removed)::int as removed
  `);
  const [row] = rows<{ updated: number; removed: number }>(result);
  return row.updated === 0 ? null : { removedEntries: row.removed };
}

/** Deletes a plan and its entries. False if there's none (or it's another household's). */
export async function deletePlan(ctx: HouseholdContext, id: string): Promise<boolean> {
  if (!uuid.safeParse(id).success) return false;
  const deleted = await getDb()
    .delete(mealPlans)
    .where(and(eq(mealPlans.householdId, ctx.householdId), eq(mealPlans.id, id)))
    .returning({ id: mealPlans.id });
  return deleted.length > 0;
}

/**
 * "Copy to a new plan" (design J): a new plan with these details holding
 * every entry of the plan `id` on the same day and meal, in the same order.
 * Entries on days past the new plan's length are left out. Returns the new
 * plan's id, or null if there's no such plan.
 */
export async function copyPlan(ctx: HouseholdContext, id: string, input: PlanInput): Promise<string | null> {
  if (!uuid.safeParse(id).success) return null;
  const { name, startDate, days, people } = planInput.parse(input);
  const result = await getDb().execute(sql`
    with source as (
      select id from meal_plans where id = ${id} and household_id = ${ctx.householdId}
    ), new_plan as (
      insert into meal_plans (household_id, name, start_date, days, people, created_by)
      select ${ctx.householdId}, ${name}, ${startDate}, ${days}, ${people}, ${ctx.userId} from source
      returning id
    ), copied as (
      insert into meal_plan_entries (plan_id, day_index, slot, recipe_id, portions_per_person, created_at)
      select n.id, e.day_index, e.slot, e.recipe_id, e.portions_per_person, e.created_at
      from meal_plan_entries e join source s on e.plan_id = s.id cross join new_plan n
      where e.day_index < ${days}
      returning id
    )
    select id from new_plan
  `);
  return rows<{ id: string }>(result)[0]?.id ?? null;
}

/**
 * Adds a recipe to a meal on one day of a plan, with 1 portion each unless
 * given. Both the plan and the recipe must be the household's, and the day
 * inside the plan. Returns the entry's id, or null.
 */
export async function addEntry(
  ctx: HouseholdContext,
  planId: string,
  entry: { dayIndex: number; slot: Slot; recipeId: string; portionsPerPerson?: number },
): Promise<string | null> {
  if (!uuid.safeParse(planId).success || !uuid.safeParse(entry.recipeId).success) return null;
  const day = dayIndex.parse(entry.dayIndex);
  const meal = slot.parse(entry.slot);
  const amount = portions.parse(entry.portionsPerPerson ?? 1);
  const result = await getDb().execute(sql`
    insert into meal_plan_entries (plan_id, day_index, slot, recipe_id, portions_per_person)
    select p.id, ${day}, ${meal}, r.id, ${amount}
    from meal_plans p join recipes r on r.household_id = p.household_id
    where p.id = ${planId} and p.household_id = ${ctx.householdId} and r.id = ${entry.recipeId} and ${day} < p.days
    returning id
  `);
  return rows<{ id: string }>(result)[0]?.id ?? null;
}

/** Sets an entry's portions each. False if there's no such entry in the household. */
export async function setEntryPortions(ctx: HouseholdContext, entryId: string, portionsPerPerson: number): Promise<boolean> {
  if (!uuid.safeParse(entryId).success) return false;
  const amount = portions.parse(portionsPerPerson);
  const result = await getDb().execute(sql`
    update meal_plan_entries e set portions_per_person = ${amount}
    from meal_plans p
    where e.id = ${entryId} and e.plan_id = p.id and p.household_id = ${ctx.householdId}
    returning e.id
  `);
  return rows(result).length > 0;
}

/**
 * Moves an entry to another day and meal of its plan (design G, "Move to…").
 * It goes after anything already in that meal. False if there's no such
 * entry in the household or the day is outside the plan.
 */
export async function moveEntry(
  ctx: HouseholdContext,
  entryId: string,
  to: { dayIndex: number; slot: Slot },
): Promise<boolean> {
  if (!uuid.safeParse(entryId).success) return false;
  const day = dayIndex.parse(to.dayIndex);
  const meal = slot.parse(to.slot);
  const result = await getDb().execute(sql`
    update meal_plan_entries e set day_index = ${day}, slot = ${meal}, created_at = now()
    from meal_plans p
    where e.id = ${entryId} and e.plan_id = p.id and p.household_id = ${ctx.householdId} and ${day} < p.days
    returning e.id
  `);
  return rows(result).length > 0;
}

/** Takes an entry out of its plan. False if there's no such entry in the household. */
export async function removeEntry(ctx: HouseholdContext, entryId: string): Promise<boolean> {
  if (!uuid.safeParse(entryId).success) return false;
  const result = await getDb().execute(sql`
    delete from meal_plan_entries e using meal_plans p
    where e.id = ${entryId} and e.plan_id = p.id and p.household_id = ${ctx.householdId}
    returning e.id
  `);
  return rows(result).length > 0;
}

export type PlanUse = { id: string; name: string; startDate: string; meals: { dayIndex: number; slot: Slot }[] };

/**
 * The household's plans a recipe is in, and the meals it's planned for, in
 * date order (for the warning before deleting it, import design H). Empty if
 * it's in none, or isn't the household's.
 */
export async function recipePlanUses(ctx: HouseholdContext, recipeId: string): Promise<PlanUse[]> {
  if (!uuid.safeParse(recipeId).success) return [];
  const found = await getDb()
    .select({
      id: mealPlans.id,
      name: mealPlans.name,
      startDate: mealPlans.startDate,
      dayIndex: mealPlanEntries.dayIndex,
      slot: mealPlanEntries.slot,
    })
    .from(mealPlanEntries)
    .innerJoin(mealPlans, eq(mealPlans.id, mealPlanEntries.planId))
    .where(and(eq(mealPlans.householdId, ctx.householdId), eq(mealPlanEntries.recipeId, recipeId)))
    .orderBy(asc(mealPlans.startDate), asc(mealPlans.name), asc(mealPlanEntries.dayIndex));
  const uses = new Map<string, PlanUse>();
  for (const row of found) {
    const use = uses.get(row.id) ?? { id: row.id, name: row.name, startDate: row.startDate, meals: [] };
    if (!use.meals.some((m) => m.dayIndex === row.dayIndex && m.slot === row.slot)) use.meals.push({ dayIndex: row.dayIndex, slot: row.slot });
    uses.set(row.id, use);
  }
  for (const use of uses.values()) {
    use.meals.sort((a, b) => a.dayIndex - b.dayIndex || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
  }
  return [...uses.values()];
}
