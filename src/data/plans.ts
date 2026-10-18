import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { mealPlanEntries, mealPlans, recipes } from "@/db/schema";
import type { Frozen, FreezerSource, LeftoversMeal, LeftoversSource } from "@/plans/leftovers";
import type { ProteinType } from "@/recipes/derive";
import type { DietaryFlag, Recipe } from "@/types/recipe";
import { MAX_PORTIONS, MIN_PORTIONS, SLOTS, planInput, portions, today, type PlanInput, type Slot } from "@/plans/plan";
import type { HouseholdContext } from "./context";
import {
  dayIndex,
  freeSql,
  frozenFrom,
  inFreezerBy,
  leftSql,
  plannedFrom,
  position,
  previousPlan,
  rows,
  slot,
  targetPosition,
  uuid,
} from "./plan-sql";

// A household's meal plans and their entries (PP-170). Anyone in the
// household can make, change and delete plans (meal plans design). Plan,
// entry and recipe ids from the client are only looked up within
// ctx.householdId. The Neon HTTP driver has no transactions, so changes that
// touch both tables are single statements.
//
// Leftovers (PP-180, designs/leftovers.html): an entry is a cook or a
// leftovers meal eating from an earlier cook, in the same plan or the plan
// just before. A cook's servings are its plan's people × portions each; what
// it has left is the recipe's servings less its own and its leftovers
// meals'. The rules (earlier cook, not more than is left) are checked in the
// same statement as each change.
//
// The freezer (PP-189, freezer.ts): a cook's leftovers can be frozen, and a
// meal can come from the freezer instead of being cooked. Frozen servings
// count against what a cook has left.

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

type LinkRow = {
  leftover_id: string;
  leftover_plan_id: string;
  leftover_date: string;
  leftover_day: number;
  leftover_slot: Slot;
  leftover_servings: number;
  cook_id: string;
  cook_plan_id: string;
  cook_date: string;
  cook_slot: Slot;
  cook_left: number;
};

/**
 * The household's plan with this id and its entries (day, then meal, then the
 * order added), or null. Each entry says where its leftovers go (a cook's
 * `leftoversTo`, in any plan, and `frozen`) or where it comes from (a
 * leftovers meal's `leftoversOf`, PP-180, or `fromFreezer`, PP-189).
 */
export async function getPlan(ctx: HouseholdContext, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const db = getDb();
  const [plan] = await db
    .select(planColumns)
    .from(mealPlans)
    .where(and(eq(mealPlans.householdId, ctx.householdId), eq(mealPlans.id, id)));
  if (!plan) return null;
  const [found, links, freezer] = await Promise.all([
    db
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
          // For the freeze sheet (PP-189): its notes, and whether it freezes.
          storage: sql<Recipe["storage"]>`${recipes.data}->'storage'`,
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
      ),
    db.execute(sql`
      select l.id as leftover_id, l.plan_id as leftover_plan_id,
        to_char(lp.start_date + l.day_index, 'YYYY-MM-DD') as leftover_date, l.day_index as leftover_day,
        l.slot as leftover_slot, (lp.people * l.portions_per_person)::float8 as leftover_servings,
        c.id as cook_id, c.plan_id as cook_plan_id, to_char(cp.start_date + c.day_index, 'YYYY-MM-DD') as cook_date,
        c.slot as cook_slot, ${leftSql("c", "cp", "r")} as cook_left
      from meal_plan_entries l
      join meal_plans lp on lp.id = l.plan_id
      join meal_plan_entries c on c.id = l.leftovers_of
      join meal_plans cp on cp.id = c.plan_id
      join recipes r on r.id = c.recipe_id
      where lp.household_id = ${ctx.householdId} and cp.household_id = ${ctx.householdId}
        and (l.plan_id = ${plan.id} or c.plan_id = ${plan.id})
      order by ${position("l", "lp")}, l.created_at
    `),
    // Each meal from the freezer, and each cook's frozen leftovers (PP-189).
    db.execute(sql`
      select e.id as entry_id, f.id as item_id, (e.from_freezer = f.id) as eats,
        to_char(f.frozen_on, 'YYYY-MM-DD') as frozen_on, f.servings, ${freeSql("f")} as free
      from meal_plan_entries e join freezer_items f on f.id = e.from_freezer or f.from_entry = e.id
      where e.plan_id = ${plan.id} and f.household_id = ${ctx.householdId}
    `),
  ]);
  const linkRows = rows<LinkRow>(links);
  const freezerRows = rows<{ entry_id: string; item_id: string; eats: boolean; frozen_on: string; servings: number; free: number }>(freezer);
  const entries = found.map((entry) => {
    const from = linkRows.find((link) => link.leftover_id === entry.id);
    const leftoversOf: LeftoversSource | null = from
      ? { entryId: from.cook_id, planId: from.cook_plan_id, date: from.cook_date, slot: from.cook_slot, left: from.cook_left }
      : null;
    const leftoversTo: LeftoversMeal[] = linkRows
      .filter((link) => link.cook_id === entry.id)
      .map((link) => ({
        entryId: link.leftover_id,
        planId: link.leftover_plan_id,
        date: link.leftover_date,
        dayIndex: link.leftover_day,
        slot: link.leftover_slot,
        servings: link.leftover_servings,
      }));
    const eats = freezerRows.find((row) => row.entry_id === entry.id && row.eats);
    const fromFreezer: FreezerSource | null = eats ? { itemId: eats.item_id, frozenOn: eats.frozen_on, free: eats.free } : null;
    const into = freezerRows.find((row) => row.entry_id === entry.id && !row.eats);
    const frozen: Frozen | null = into ? { itemId: into.item_id, frozenOn: into.frozen_on, servings: into.servings } : null;
    return { ...entry, leftoversOf, leftoversTo, fromFreezer, frozen };
  });
  return { ...plan, entries };
}

/** The plan that starts next after this one, for planning leftovers next week (Kris, 2026-10-18), or null. */
export async function nextPlan(ctx: HouseholdContext, id: string) {
  if (!uuid.safeParse(id).success) return null;
  const result = await getDb().execute(sql`
    select n.id, n.name, to_char(n.start_date, 'YYYY-MM-DD') as "startDate", n.days, n.people
    from meal_plans p join meal_plans n on n.household_id = p.household_id and n.start_date > p.start_date
    where p.id = ${id} and p.household_id = ${ctx.householdId}
    order by n.start_date, n.created_at
    limit 1
  `);
  return rows<{ id: string; name: string; startDate: string; days: number; people: number }>(result)[0] ?? null;
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
 * the days cut off (the edit sheet warns first). Frozen leftovers follow
 * their cook's new date; ones from removed days that haven't gone in yet are
 * taken off the freezer list (PP-189). Null if there's no such plan.
 */
export async function updatePlan(
  ctx: HouseholdContext,
  id: string,
  input: PlanInput,
  todayDate: string = today(),
): Promise<{ removedEntries: number } | null> {
  if (!uuid.safeParse(id).success) return null;
  const { name, startDate, days, people } = planInput.parse(input);
  const result = await getDb().execute(sql`
    with updated as (
      update meal_plans
      set name = ${name}, start_date = ${startDate}, days = ${days}, people = ${people}, updated_at = now()
      where id = ${id} and household_id = ${ctx.householdId}
      returning id, days, start_date
    ), not_going_in as (
      delete from freezer_items f using meal_plan_entries e, updated u
      where f.from_entry = e.id and e.plan_id = u.id and e.day_index >= u.days and f.frozen_on > ${todayDate}::date
    ), moved_freezing as (
      update freezer_items f set frozen_on = u.start_date + e.day_index
      from meal_plan_entries e, updated u
      where f.from_entry = e.id and e.plan_id = u.id and e.day_index < u.days
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

/**
 * Deletes a plan and its entries. Frozen leftovers from it that haven't gone
 * in yet are taken off the freezer list; ones already in stay (PP-189).
 * False if there's none (or it's another household's).
 */
export async function deletePlan(ctx: HouseholdContext, id: string, todayDate: string = today()): Promise<boolean> {
  if (!uuid.safeParse(id).success) return false;
  const result = await getDb().execute(sql`
    with not_going_in as (
      delete from freezer_items f using meal_plan_entries e, meal_plans p
      where f.from_entry = e.id and e.plan_id = p.id and p.id = ${id} and p.household_id = ${ctx.householdId}
        and f.frozen_on > ${todayDate}::date
    )
    delete from meal_plans where id = ${id} and household_id = ${ctx.householdId}
    returning id
  `);
  return rows(result).length > 0;
}

/**
 * "Copy to a new plan" (design J): a new plan with these details holding
 * every entry of the plan `id` on the same day and meal, in the same order.
 * Entries on days past the new plan's length are left out. Leftovers meals
 * come along with their cooks in the same plan; ones eating from the plan
 * before or from the freezer aren't copied, nor is freezing (leftovers
 * design). Returns the new plan's id, or null
 * if there's no such plan.
 */
export async function copyPlan(ctx: HouseholdContext, id: string, input: PlanInput): Promise<string | null> {
  if (!uuid.safeParse(id).success) return null;
  const { name, startDate, days, people } = planInput.parse(input);
  // New ids are made up front so a copied leftovers meal can point at its copied cook.
  const result = await getDb().execute(sql`
    with source as (
      select id from meal_plans where id = ${id} and household_id = ${ctx.householdId}
    ), new_plan as (
      insert into meal_plans (household_id, name, start_date, days, people, created_by)
      select ${ctx.householdId}, ${name}, ${startDate}, ${days}, ${people}, ${ctx.userId} from source
      returning id
    ), kept as materialized (
      select e.*, gen_random_uuid() as new_id
      from meal_plan_entries e join source s on e.plan_id = s.id
      where e.day_index < ${days} and e.from_freezer is null
    ), copied as (
      insert into meal_plan_entries (id, plan_id, day_index, slot, recipe_id, portions_per_person, leftovers_of, created_at)
      select k.new_id, n.id, k.day_index, k.slot, k.recipe_id, k.portions_per_person, cook.new_id, k.created_at
      from kept k cross join new_plan n
      left join kept cook on cook.id = k.leftovers_of
      where k.leftovers_of is null or cook.id is not null
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

/**
 * Sets an entry's portions each. A leftovers meal can't take more than its
 * cook has left, nor a meal from the freezer more than's free there; a cook
 * with leftovers planned or frozen can't go up past what they need
 * (leftovers design B and E). False if it isn't allowed or there's no
 * such entry in the household.
 */
export async function setEntryPortions(ctx: HouseholdContext, entryId: string, portionsPerPerson: number): Promise<boolean> {
  if (!uuid.safeParse(entryId).success) return false;
  // Typed, or Postgres reads it as an integer next to `people`.
  const amount = sql`${portions.parse(portionsPerPerson)}::float8`;
  const result = await getDb().execute(sql`
    update meal_plan_entries e set portions_per_person = ${amount}
    from meal_plans p
    where e.id = ${entryId} and e.plan_id = p.id and p.household_id = ${ctx.householdId}
      and (
        (e.leftovers_of is not null and p.people * ${amount} <= (
          select ${leftSql("c", "cp", "r", "e")}
          from meal_plan_entries c join meal_plans cp on cp.id = c.plan_id join recipes r on r.id = c.recipe_id
          where c.id = e.leftovers_of
        ))
        or (e.from_freezer is not null and p.people * ${amount} <= (
          select ${freeSql("f", "e")} from freezer_items f where f.id = e.from_freezer
        ))
        or (e.from_freezer is null and e.leftovers_of is null and (
          ${amount} <= e.portions_per_person
          or (
            not exists (select 1 from meal_plan_entries l where l.leftovers_of = e.id)
            and not exists (select 1 from freezer_items fz where fz.from_entry = e.id)
          )
          or (select r.serves from recipes r where r.id = e.recipe_id) - p.people * ${amount} - ${plannedFrom("e")} - ${frozenFrom("e")} >= 0
        ))
      )
    returning e.id
  `);
  return rows(result).length > 0;
}

/**
 * Moves an entry to another day and meal of its plan (design G, "Move to…").
 * It goes after anything already in that meal. A leftovers meal stays after
 * its cook, and a cook before its leftovers (leftovers design B and E); a
 * meal from the freezer stays after it goes in, and frozen leftovers move
 * with their cook (PP-189). False if it isn't allowed, there's no such entry in the household or the
 * day is outside the plan.
 */
export async function moveEntry(
  ctx: HouseholdContext,
  entryId: string,
  to: { dayIndex: number; slot: Slot },
): Promise<boolean> {
  if (!uuid.safeParse(entryId).success) return false;
  const day = dayIndex.parse(to.dayIndex);
  const meal = slot.parse(to.slot);
  const target = targetPosition("p", day, meal);
  const result = await getDb().execute(sql`
    with moved as (
      update meal_plan_entries e set day_index = ${day}, slot = ${meal}, created_at = now()
      from meal_plans p
      where e.id = ${entryId} and e.plan_id = p.id and p.household_id = ${ctx.householdId} and ${day} < p.days
        and not exists (
          select 1 from meal_plan_entries c join meal_plans cp on cp.id = c.plan_id
          where c.id = e.leftovers_of and ${position("c", "cp")} >= ${target}
        )
        and not exists (
          select 1 from meal_plan_entries l join meal_plans lp on lp.id = l.plan_id
          where l.leftovers_of = e.id and ${position("l", "lp")} <= ${target}
        )
        and not exists (select 1 from freezer_items f where f.id = e.from_freezer and not ${inFreezerBy("f", target)})
        and not exists (
          select 1 from freezer_items f join meal_plan_entries m on m.from_freezer = f.id join meal_plans mp on mp.id = m.plan_id
          where f.from_entry = e.id and ${position("m", "mp")} <= ${target}
        )
      returning e.id, p.start_date + e.day_index as day
    ), freezing as (
      update freezer_items f set frozen_on = m.day from moved m where f.from_entry = m.id
    )
    select id from moved
  `);
  return rows(result).length > 0;
}

/**
 * Plans leftovers from a cook for a meal (leftovers design C and D): the cook
 * must be the household's, in this plan or the plan just before, earlier than
 * the meal, and not itself leftovers; and it must have enough left for the
 * plan's people × portions each. Portions each default to 1, or less when
 * fewer are left (½ at least). Returns the new entry's id, or null.
 */
export async function addLeftovers(
  ctx: HouseholdContext,
  planId: string,
  entry: { dayIndex: number; slot: Slot; cookId: string; portionsPerPerson?: number },
): Promise<string | null> {
  if (!uuid.safeParse(planId).success || !uuid.safeParse(entry.cookId).success) return null;
  const day = dayIndex.parse(entry.dayIndex);
  const meal = slot.parse(entry.slot);
  const amount = entry.portionsPerPerson === undefined ? null : portions.parse(entry.portionsPerPerson);
  const result = await getDb().execute(sql`
    insert into meal_plan_entries (plan_id, day_index, slot, recipe_id, portions_per_person, leftovers_of)
    select p.id, ${day}, ${meal}, c.recipe_id, x.amount, c.id
    from meal_plans p
    join meal_plan_entries c on c.id = ${entry.cookId} and c.leftovers_of is null and c.from_freezer is null
    join meal_plans cp on cp.id = c.plan_id and cp.household_id = p.household_id
    join recipes r on r.id = c.recipe_id
    cross join lateral (select ${leftSql("c", "cp", "r")} as left_over) rest
    cross join lateral (
      select coalesce(${amount}::float8, least(1, floor(rest.left_over * 2 / p.people) / 2)) as amount
    ) x
    where p.id = ${planId} and p.household_id = ${ctx.householdId} and ${day} < p.days
      and (cp.id = p.id or cp.id = ${previousPlan("p")})
      and ${position("c", "cp")} < ${targetPosition("p", day, meal)}
      and x.amount >= ${MIN_PORTIONS}::float8 and x.amount <= ${MAX_PORTIONS}::float8
      and p.people * x.amount <= rest.left_over
    returning id
  `);
  return rows<{ id: string }>(result)[0]?.id ?? null;
}

export type { LeftoversMeal, LeftoversSource };

export type AvailableLeftovers = {
  cookId: string;
  planId: string;
  date: string;
  slot: Slot;
  left: number;
  recipe: {
    id: string;
    slug: string;
    name: string;
    proteinType: ProteinType;
    dietary: DietaryFlag[];
    kcal: number;
    proteinG: number;
    nutritionSource: "printed" | "estimated";
  };
};

/**
 * Cooks with leftovers still to plan before a meal (leftovers design D): in
 * this plan or the plan just before, with enough left for everyone to have
 * ½, oldest first.
 */
export async function availableLeftovers(
  ctx: HouseholdContext,
  planId: string,
  at: { dayIndex: number; slot: Slot },
): Promise<AvailableLeftovers[]> {
  if (!uuid.safeParse(planId).success) return [];
  const day = dayIndex.parse(at.dayIndex);
  const meal = slot.parse(at.slot);
  const result = await getDb().execute(sql`
    select c.id as "cookId", c.plan_id as "planId", to_char(cp.start_date + c.day_index, 'YYYY-MM-DD') as date, c.slot,
      rest.left_over as left, r.id as recipe_id, r.slug, r.name, r.protein_type, r.dietary, r.kcal, r.protein_g, r.nutrition_source
    from meal_plans p
    join meal_plans cp on cp.household_id = p.household_id and (cp.id = p.id or cp.id = ${previousPlan("p")})
    join meal_plan_entries c on c.plan_id = cp.id and c.leftovers_of is null and c.from_freezer is null
    join recipes r on r.id = c.recipe_id
    cross join lateral (select ${leftSql("c", "cp", "r")} as left_over) rest
    where p.id = ${planId} and p.household_id = ${ctx.householdId}
      and ${position("c", "cp")} < ${targetPosition("p", day, meal)}
      and rest.left_over >= p.people * ${MIN_PORTIONS}::float8
    order by ${position("c", "cp")}, c.created_at
  `);
  type Row = Omit<AvailableLeftovers, "recipe"> & {
    recipe_id: string;
    slug: string;
    name: string;
    protein_type: ProteinType;
    dietary: DietaryFlag[];
    kcal: number;
    protein_g: number;
    nutrition_source: "printed" | "estimated";
  };
  return rows<Row>(result).map((row) => ({
    cookId: row.cookId,
    planId: row.planId,
    date: row.date,
    slot: row.slot,
    left: row.left,
    recipe: {
      id: row.recipe_id,
      slug: row.slug,
      name: row.name,
      proteinType: row.protein_type,
      dietary: row.dietary,
      kcal: row.kcal,
      proteinG: row.protein_g,
      nutritionSource: row.nutrition_source,
    },
  }));
}

/**
 * Takes an entry out of its plan; a cook's leftovers meals go with it (the
 * sheet asks first, leftovers design L), and so do its frozen leftovers if
 * they haven't gone in yet (PP-189). False if there's no such entry in the
 * household.
 */
export async function removeEntry(ctx: HouseholdContext, entryId: string, todayDate: string = today()): Promise<boolean> {
  if (!uuid.safeParse(entryId).success) return false;
  const result = await getDb().execute(sql`
    with not_going_in as (
      delete from freezer_items f using meal_plan_entries e, meal_plans p
      where f.from_entry = e.id and e.id = ${entryId} and e.plan_id = p.id and p.household_id = ${ctx.householdId}
        and f.frozen_on > ${todayDate}::date
    )
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
