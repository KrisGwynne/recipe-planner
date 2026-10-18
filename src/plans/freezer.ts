import { addDays, formatDay, formatPortions } from "./plan";

// The freezer's rules and wording (PP-189, designs/leftovers.html F to K).

/** Servings in the freezer go in halves, up to 50 a batch (the add sheet's stepper, design J). */
export const MAX_FROZEN = 50;

/** "today", "yesterday", "5 days ago", "1 week ago", "3 weeks ago", "2 months ago", "1 year ago". */
export function ago(date: string, today: string): string {
  let days = 0;
  while (addDays(date, days) < today) days++;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 56) return days < 14 ? "1 week ago" : `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/** "4 to freeze" before the cook's day, "4 frozen" from then on (leftovers design A). */
export function frozenLabel(frozen: { servings: number; frozenOn: string }, today: string): string {
  return `${formatPortions(frozen.servings)} ${frozen.frozenOn > today ? "to freeze" : "frozen"}`;
}

/**
 * What's in the freezer for its row on the Plans tab and its page's header
 * (design G and H): "7 servings of 2 recipes · 4 going in Tue".
 */
export function freezerSummary(items: { recipe: { id: string }; inFreezer: number; goingIn: boolean; frozenOn: string }[]) {
  const inNow = items.filter((i) => !i.goingIn);
  const going = items.filter((i) => i.goingIn);
  const total = inNow.reduce((sum, i) => sum + i.inFreezer, 0);
  const recipes = new Set(inNow.map((i) => i.recipe.id)).size;
  const goingTotal = going.reduce((sum, i) => sum + i.inFreezer, 0);
  const parts: string[] = [];
  if (total > 0) parts.push(`${servingsText(total)} of ${recipes === 1 ? "1 recipe" : `${recipes} recipes`}`);
  if (goingTotal > 0) parts.push(`${formatPortions(goingTotal)} going in ${formatDay(going[0].frozenOn).split(" ")[0]}`);
  return { in: total, goingIn: goingTotal, text: parts.join(" · ") || "Nothing in the freezer" };
}

function servingsText(n: number): string {
  return n === 1 ? "1 serving" : `${formatPortions(n)} servings`;
}
