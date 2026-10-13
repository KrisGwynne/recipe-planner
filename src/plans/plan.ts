import { z } from "zod";

// Meal plan rules (PP-170, designs/meal-plans.html). Dates are plain
// "YYYY-MM-DD" strings, like Postgres `date`, so there are no time zones in
// the data; only "today" needs one (UK time for now, PP-181).

export const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Slot = (typeof SLOTS)[number];

export const slotLabels: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const MAX_DAYS = 14;
export const MAX_PEOPLE = 12;
export const MIN_PORTIONS = 0.5;
export const MAX_PORTIONS = 4;

// A real calendar date (no 30 February).
const isoDate = z.iso.date("Choose a start date");

/** A plan's details, from the New plan and Edit plan sheets (design C and K). */
export const planInput = z.object({
  name: z.string().trim().min(1, "Enter a name for the plan").max(50, "Use 50 characters or fewer"),
  startDate: isoDate,
  days: z.coerce.number().int().min(1).max(MAX_DAYS),
  people: z.coerce.number().int().min(1).max(MAX_PEOPLE),
});
export type PlanInput = z.infer<typeof planInput>;

/** Portions each go in halves from ½ to 4 (design F). */
export const portions = z
  .number()
  .min(MIN_PORTIONS)
  .max(MAX_PORTIONS)
  .refine((n) => Number.isInteger(n * 2), "Portions go in halves");

/** Today's date in the UK (PP-181: UK time everywhere for now). */
export function today(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The plan's last day. */
export function planEnd(plan: { startDate: string; days: number }): string {
  return addDays(plan.startDate, plan.days - 1);
}

/** The date of a day in the plan (day 0 is the start date). */
export function planDay(plan: { startDate: string }, dayIndex: number): string {
  return addDays(plan.startDate, dayIndex);
}

// Fixed names rather than Intl, whose en-GB data writes "Sept".
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(date: string) {
  const d = toDate(date);
  const weekday = WEEKDAYS[d.getUTCDay()];
  const month = MONTHS[d.getUTCMonth()];
  return {
    weekday: weekday.slice(0, 3),
    weekdayLong: weekday,
    day: d.getUTCDate(),
    month: month.slice(0, 3),
    monthLong: month,
    year: d.getUTCFullYear(),
  };
}

/** "Mon 12 Oct". */
export function formatDay(date: string): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Monday 19 October", plus the year when it isn't this year's. */
export function formatLongDate(date: string, todayDate: string = today()): string {
  const p = parts(date);
  const year = p.year === parts(todayDate).year ? "" : ` ${p.year}`;
  return `${p.weekdayLong} ${p.day} ${p.monthLong}${year}`;
}

/**
 * The plan header's dates: "Mon 12 – Sun 18 Oct", "Mon 28 Sep – Sun 4 Oct",
 * or "Mon 12 Oct" for one day. With `weekdays: false`, as on past plans:
 * "5 – 11 Oct". Years appear only when the plan spans two.
 */
export function formatRange(plan: { startDate: string; days: number }, { weekdays = true } = {}): string {
  const a = parts(plan.startDate);
  const b = parts(planEnd(plan));
  const day = (p: typeof a) => (weekdays ? `${p.weekday} ${p.day}` : `${p.day}`);
  if (plan.days === 1) return `${day(a)} ${a.month}`;
  if (a.year !== b.year) return `${day(a)} ${a.month} ${a.year} – ${day(b)} ${b.month} ${b.year}`;
  if (a.month !== b.month) return `${day(a)} ${a.month} – ${day(b)} ${b.month}`;
  return `${day(a)} – ${day(b)} ${b.month}`;
}

/** A new plan's name until it's changed (design C): "Week of 19 Oct". */
export function defaultPlanName(startDate: string): string {
  const p = parts(startDate);
  return `Week of ${p.day} ${p.month}`;
}

/** A new plan starts the day after the latest plan ends, or today if that's passed or there are none (design C). */
export function defaultStartDate(plans: { startDate: string; days: number }[], todayDate: string = today()): string {
  const next = plans.map((plan) => addDays(planEnd(plan), 1)).sort().at(-1);
  return next && next > todayDate ? next : todayDate;
}

/**
 * The plan list's groups (design A): plans covering today, then those to come
 * (soonest first), then past plans (newest first).
 */
export function groupPlans<P extends { startDate: string; days: number }>(plans: P[], todayDate: string = today()) {
  const current: P[] = [];
  const upcoming: P[] = [];
  const past: P[] = [];
  for (const plan of plans) {
    if (plan.startDate > todayDate) upcoming.push(plan);
    else if (planEnd(plan) < todayDate) past.push(plan);
    else current.push(plan);
  }
  current.sort((x, y) => x.startDate.localeCompare(y.startDate));
  upcoming.sort((x, y) => x.startDate.localeCompare(y.startDate));
  past.sort((x, y) => y.startDate.localeCompare(x.startDate));
  return { current, upcoming, past };
}

/** "½", "1", "1½". */
export function formatPortions(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5 ? "½" : "";
  return whole === 0 ? half || "0" : `${whole}${half}`;
}

/** "1 meal", "8 meals". */
export function meals(count: number): string {
  return count === 1 ? "1 meal" : `${count} meals`;
}

/** Servings a meal needs: people × portions each ("2 people × 1½ = 3 servings", design F). */
export function servingsPlanned(people: number, portionsPerPerson: number): number {
  return people * portionsPerPerson;
}

/**
 * The servings the recipe page opens at from a planned meal: whole servings,
 * rounded up so there's enough (4½ planned opens at 5).
 */
export function recipeServings(people: number, portionsPerPerson: number): number {
  return Math.ceil(servingsPlanned(people, portionsPerPerson));
}

/** "Thu dinner", as toasts and buttons say it. */
export function mealName(plan: { startDate: string }, dayIndex: number, slot: Slot): string {
  return `${parts(planDay(plan, dayIndex)).weekday} ${slot}`;
}

/** "1 serving", "4½ servings". */
export function servings(n: number): string {
  return n === 1 ? "1 serving" : `${formatPortions(n)} servings`;
}

/**
 * The plan "Add to plan" picks first (design G): the one covering today, or
 * else the next to start. Past plans aren't offered (Kris, 2026-10-13).
 */
export function plansToAddTo<P extends { startDate: string; days: number }>(plans: P[], todayDate: string = today()): P[] {
  const { current, upcoming } = groupPlans(plans, todayDate);
  return [...current, ...upcoming];
}
