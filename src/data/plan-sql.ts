import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { MAX_DAYS, SLOTS, type Slot } from "@/plans/plan";

// SQL shared by meal plans (plans.ts) and the freezer (freezer.ts). Aliases
// are passed as strings: `e` an entry, `p` its plan, `r` a recipe, `f` a
// freezer item. Every rule about leftovers and the freezer is checked inside
// the statement that makes the change, since the Neon HTTP driver has no
// transactions.

export const uuid = z.uuid();
export const dayIndex = z.number().int().min(0).max(MAX_DAYS - 1);
export const slot = z.enum(SLOTS);

export function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

const SLOT_ORDER = "array['breakfast','lunch','dinner','snack']::text[]";

/** A meal's place in time: its date, then breakfast, lunch, dinner, snack. */
export function position(e: string, p: string) {
  return sql.raw(`(${p}.start_date + ${e}.day_index, array_position(${SLOT_ORDER}, ${e}.slot))`);
}

/** A meal to be planned on day `day` of plan `p`, as position(). */
export function targetPosition(p: string, day: number, meal: Slot) {
  return sql`(${sql.raw(p)}.start_date + ${day}::int, array_position(${sql.raw(SLOT_ORDER)}, ${meal}::text))`;
}

/** Servings planned as leftovers of cook `c`, leaving out entry `except` if given. */
export function plannedFrom(c: string, except?: string) {
  return sql`coalesce((
    select sum(lp.people * l.portions_per_person) from meal_plan_entries l join meal_plans lp on lp.id = l.plan_id
    where l.leftovers_of = ${sql.raw(c)}.id ${except ? sql`and l.id <> ${sql.raw(except)}.id` : sql``}
  ), 0)::float8`;
}

/** Servings of cook `c` frozen (PP-189), leaving out the freezer item `except` if given. */
export function frozenFrom(c: string) {
  return sql`coalesce((select sum(fz.servings) from freezer_items fz where fz.from_entry = ${sql.raw(c)}.id), 0)::float8`;
}

/**
 * What cook `c` (in plan `cp`, recipe `r`) has left over: the recipe's
 * servings less its own, its leftovers meals' and what's frozen. Below 0 when
 * a plan's people go up. `except` leaves out one leftovers meal.
 */
export function leftSql(c: string, cp: string, r: string, except?: string) {
  return sql`(${sql.raw(r)}.serves - ${sql.raw(cp)}.people * ${sql.raw(c)}.portions_per_person - ${plannedFrom(c, except)} - ${frozenFrom(c)})::float8`;
}

/** The plan just before plan `p`: the latest one in the household starting earlier. */
export function previousPlan(p: string) {
  return sql`(select pp.id from meal_plans pp where pp.household_id = ${sql.raw(p)}.household_id and pp.start_date < ${sql.raw(p)}.start_date order by pp.start_date desc, pp.created_at desc limit 1)`;
}

/** Servings of freezer item `f` planned in meals, all of them or only those before `before` (a date). */
function eatenFrom(f: string, { before, except }: { before?: string; except?: string } = {}) {
  return sql`coalesce((
    select sum(mp.people * m.portions_per_person) from meal_plan_entries m join meal_plans mp on mp.id = m.plan_id
    where m.from_freezer = ${sql.raw(f)}.id
      ${before ? sql`and mp.start_date + m.day_index < ${before}::date` : sql``}
      ${except ? sql`and m.id <> ${sql.raw(except)}.id` : sql``}
  ), 0)::float8`;
}

/** What's in freezer item `f` now: what went in, corrected by hand, less meals eaten before today. */
export function inFreezer(f: string, today: string) {
  return sql`(${sql.raw(f)}.servings + ${sql.raw(f)}.adjustment - ${eatenFrom(f, { before: today })})::float8`;
}

/** Servings of freezer item `f` planned for today or later. */
export function plannedFromFreezer(f: string, today: string) {
  return sql`(${eatenFrom(f)} - ${eatenFrom(f, { before: today })})::float8`;
}

/** What freezer item `f` has that no meal is planned to eat, leaving out meal `except` if given. */
export function freeSql(f: string, except?: string) {
  return sql`(${sql.raw(f)}.servings + ${sql.raw(f)}.adjustment - ${eatenFrom(f, { except })})::float8`;
}

/**
 * Whether freezer item `f` is in the freezer by a meal at `target`
 * (targetPosition): frozen on an earlier day, or that day, after its cook
 * when it came from one.
 */
export function inFreezerBy(f: string, target: ReturnType<typeof targetPosition>) {
  return sql`(
    ${sql.raw(f)}.frozen_on < (${target}).f1
    or (${sql.raw(f)}.frozen_on = (${target}).f1 and (
      ${sql.raw(f)}.from_entry is null
      or exists (
        select 1 from meal_plan_entries fc join meal_plans fcp on fcp.id = fc.plan_id
        where fc.id = ${sql.raw(f)}.from_entry and ${position("fc", "fcp")} < ${target}
      )
    ))
  )`;
}
