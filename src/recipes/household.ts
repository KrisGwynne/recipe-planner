import { formatShortDate } from "@/plans/plan";

// Wording for the household's cooking history on the recipe page (PP-169,
// recipe design A and F). Days are YYYY-MM-DD, most recent first.

/** Longest "Our notes" can be (Kris, 2026-10-14). */
export const MAX_NOTES = 2000;

/** How many days the history names before "and N more" (Kris, 2026-10-14). */
export const HISTORY_DAYS = 3;

/** "2 Oct", "today", or "21 Aug 2025" when it isn't this year. */
export function cookedDay(day: string, today: string): string {
  return day === today ? "today" : formatShortDate(day, today);
}

function times(n: number): string {
  return n === 1 ? "Cooked once" : n === 2 ? "Cooked twice" : `Cooked ${n} times`;
}

/** The top card (design A): "Cooked 3 times · last on 2 Oct", or "Not cooked yet". */
export function cookedSummary(cooked: string[], today: string): string {
  if (cooked.length === 0) return "Not cooked yet";
  const last = cookedDay(cooked[0], today);
  return `${times(cooked.length)} · last ${last === "today" ? "today" : `on ${last}`}`;
}

/** The Notes section (design F): "Cooked 7 times: today, 14 Sep, 21 Aug and 4 more". */
export function cookedHistory(cooked: string[], today: string): string {
  if (cooked.length === 0) return "Not cooked yet";
  const named = cooked.slice(0, HISTORY_DAYS).map((day) => cookedDay(day, today));
  const more = cooked.length - named.length;
  const list = more > 0 ? `${named.join(", ")} and ${more} more` : named.join(", ");
  return `${times(cooked.length)}: ${list}`;
}
