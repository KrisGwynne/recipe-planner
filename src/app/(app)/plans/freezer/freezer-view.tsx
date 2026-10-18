"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { AddToFreezerSheet, type FreezerRecipe } from "@/components/plans/add-to-freezer-sheet";
import { SlotGridSheet, type PlanOption } from "@/components/plans/slot-grid-sheet";
import { categoryDotClasses, categoryLabels, categoryOf } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import type { FreezerItem } from "@/data";
import { cx } from "@/lib/cx";
import { MAX_FROZEN, ago } from "@/plans/freezer";
import { andList } from "@/plans/nutrition";
import { MIN_PORTIONS, formatDay, formatLongDate, formatPortions, formatShortDate, mealName, planDay, servings } from "@/plans/plan";
import { browsingCategory } from "@/recipes/derive";
import { addFromFreezerAction, addToFreezerAction, removeFromFreezerAction, setFreezerCountAction } from "./actions";

const focus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";
const row = cx("w-full flex items-center gap-3 px-3 min-h-12 text-left hover:bg-surface-2", focus);

/** "Thu 15 dinner". */
function dayAndMeal(meal: { date: string; slot: string }): string {
  return `${formatDay(meal.date).split(" ").slice(0, 2).join(" ")} ${meal.slot}`;
}

function plannedTotal(item: FreezerItem): number {
  return item.planned.reduce((sum, m) => sum + m.servings, 0);
}

/**
 * The freezer (leftovers design H to K): what's in it, oldest first, then
 * what's going in; each opens its sheet (I). "Add to freezer" floats above
 * the tab bar (J). Empty, it says so with one action (K).
 */
export function FreezerView({
  items,
  today,
  plans,
  recipes,
}: {
  items: FreezerItem[];
  today: string;
  plans: PlanOption[];
  recipes: FreezerRecipe[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const open = items.find((i) => i.id === openId);
  const inNow = items.filter((i) => !i.goingIn);
  const going = items.filter((i) => i.goingIn);

  return (
    <>
      {items.length === 0 ? (
        <div className="mx-auto max-w-sm px-8 pt-20 text-center">
          <span className="mx-auto size-16 rounded-full bg-surface-2 grid place-items-center">
            <Icon name="snow" className="size-8" />
          </span>
          <p className="font-display text-[22px] font-semibold mt-5">Nothing in the freezer</p>
          <p className="text-ink-muted mt-2">
            Freeze leftovers from a plan, or add something you&apos;ve batch-cooked. Then plan meals from it.
          </p>
          <button type="button" onClick={() => setAdding(true)} className={buttonClasses("primary", "mt-6 w-full")}>
            <Icon name="plus" className="size-5" />
            Add to freezer
          </button>
        </div>
      ) : (
        <div className="px-5 pt-4 space-y-4">
          {inNow.length > 0 && (
            <ul aria-label="In the freezer" className="rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
              {inNow.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} today={today} onOpen={() => setOpenId(item.id)} />
                </li>
              ))}
            </ul>
          )}
          {going.length > 0 && (
            <section aria-labelledby="going-in">
              <h2 id="going-in" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Going in
              </h2>
              <ul className="mt-2 rounded-card border border-dashed border-line divide-y divide-line overflow-hidden">
                {going.map((item) => (
                  <li key={item.id}>
                    <ItemRow item={item} today={today} onOpen={() => setOpenId(item.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={cx(
              "fixed z-30 right-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-8 md:right-8",
              "h-12 pl-4 pr-5 rounded-full bg-ink text-bg font-semibold inline-flex items-center gap-2 shadow-xl",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            )}
          >
            <Icon name="plus" className="size-5" strokeWidth={2.5} />
            Add to freezer
          </button>
        </div>
      )}
      {open && <ItemSheet key={open.id} item={open} today={today} plans={plans} onClose={() => setOpenId(null)} />}
      {adding && <AddToFreezerSheet recipes={recipes} today={today} onClose={() => setAdding(false)} />}
    </>
  );
}

/** A row of the freezer (design H): the recipe, when it went in (or goes in), meals planned from it, and how many servings. */
function ItemRow({ item, today, onOpen }: { item: FreezerItem; today: string; onOpen: () => void }) {
  const category = categoryOf(browsingCategory(item.recipe.proteinType, item.recipe.dietary));
  return (
    <button type="button" onClick={onOpen} className={cx("w-full flex items-center gap-3 px-4 py-3 min-h-16 text-left hover:bg-surface-2", focus)}>
      <span className="w-1 self-stretch flex flex-col rounded-full overflow-hidden" aria-hidden="true">
        {categoryDotClasses(category).map((dot) => (
          <span key={dot} className={cx("flex-1", dot)} />
        ))}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{item.recipe.name}</span>
        <span className="sr-only">{categoryLabels[category]}</span>
        <span className="block text-sm text-ink-muted tabular-nums">
          {item.goingIn
            ? `${formatDay(item.frozenOn)}${item.from ? ` · from ${item.from.planName}'s ${item.from.slot}` : ""}`
            : `Frozen ${formatShortDate(item.frozenOn, today)} · ${ago(item.frozenOn, today)}`}
        </span>
        {item.planned.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {item.planned.map((meal) => (
              <span
                key={meal.entryId}
                className="h-6 px-2 rounded-full border border-line text-ink-muted text-xs font-semibold inline-flex items-center gap-1"
              >
                <Icon name="check" className="size-3.5" strokeWidth={2.5} />
                {formatPortions(meal.servings)} for {dayAndMeal(meal)}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="text-right shrink-0">
        <span className={cx("block text-xl font-semibold tabular-nums", item.goingIn && "text-ink-muted")}>
          {formatPortions(item.inFreezer)}
        </span>
        <span className="block text-xs text-ink-muted">{item.inFreezer === 1 ? "serving" : "servings"}</span>
      </span>
    </button>
  );
}

/**
 * Something in the freezer (design I): the count, saved as it's tapped, not
 * below what's planned; the meals planned from it; the recipe's storage
 * notes; Plan it, Recipe and Take it all out (asking first when meals are
 * planned from it). Servings still to go in are changed from their cook.
 */
function ItemSheet({ item, today, plans, onClose }: { item: FreezerItem; today: string; plans: PlanOption[]; onClose: () => void }) {
  const toast = useToast();
  const [count, setCount] = useState(item.inFreezer);
  const [mode, setMode] = useState<"sheet" | "planning" | "removing">("sheet");
  const [, startSaving] = useTransition();
  const planned = plannedTotal(item);
  const free = count - planned;

  function change(value: number) {
    setCount(value);
    startSaving(async () => {
      if (!(await setFreezerCountAction(item.id, value))) toast("Couldn't save the count. Try again.");
    });
  }

  async function remove() {
    onClose();
    if (!(await removeFromFreezerAction(item.id))) {
      toast("Couldn't take that out. Try again.");
      return;
    }
    const undo =
      planned === 0 && !item.goingIn
        ? () => void addToFreezerAction({ recipeId: item.recipe.id, servings: count, frozenOn: item.frozenOn })
        : undefined;
    toast(`${item.recipe.name} taken out`, undo ? { undo } : undefined);
  }

  if (mode === "planning") {
    return (
      <SlotGridSheet
        title="Plan it"
        recipeName={`${item.recipe.name} · ${formatPortions(free)} free`}
        verb="Add to"
        grid={null}
        plans={plans}
        portions={{ serves: item.recipe.serves, each: 1 }}
        blocked={(grid, cell) => planDay(grid, cell.dayIndex) < item.frozenOn}
        leftovers={{ left: free }}
        onChoose={async (grid, to, each) => {
          const id = await addFromFreezerAction(grid.id, { ...to, itemId: item.id, portionsPerPerson: each });
          onClose();
          toast(id ? `Added to ${mealName(grid, to.dayIndex, to.slot)}` : "Couldn't plan that. Try again.");
        }}
        onClose={() => setMode("sheet")}
      />
    );
  }

  if (mode === "removing") {
    return (
      <Sheet title="Take it all out?" onClose={() => setMode("sheet")}>
        <p className="text-ink-muted">
          {servings(planned)} {planned <= 1 ? "is" : "are"} planned for {andList(item.planned.map(dayAndMeal))}. Those meals
          will be cooked instead.
        </p>
        <button type="button" onClick={remove} className={buttonClasses("danger", "mt-5 w-full")}>
          Take it all out
        </button>
        <button type="button" onClick={() => setMode("sheet")} className={buttonClasses("ghost", "mt-2 w-full")}>
          Cancel
        </button>
      </Sheet>
    );
  }

  const storage = item.recipe.storage;
  return (
    <Sheet
      title={item.recipe.name}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={buttonClasses("primary", "w-full")}>
          Done
        </button>
      }
    >
      <p className="-mt-1 text-sm text-ink-muted">
        {item.goingIn ? "Goes in" : "Frozen"} {formatDay(item.frozenOn)}
        {item.from && ` · from ${item.from.planName}, ${dayAndMeal(item.from)}`}
      </p>

      {item.goingIn ? (
        <p className="mt-4 text-sm">
          {servings(item.inFreezer)} go in on {formatLongDate(item.frozenOn, today)}, after {item.from?.slot ?? "the meal"}.{" "}
          {item.from && (
            <Link href={`/plans/${item.from.planId}`} className="font-semibold text-primary">
              Change it in {item.from.planName}
            </Link>
          )}
        </p>
      ) : (
        <div className="mt-4">
          <Stepper
            label="In the freezer"
            hint={planned > 0 ? `${formatPortions(planned)} planned, so not below that` : "Fix the count if it's wrong"}
            value={count}
            min={Math.max(planned, MIN_PORTIONS)}
            max={MAX_FROZEN}
            step={0.5}
            format={formatPortions}
            onChange={change}
          />
        </div>
      )}

      {(item.planned.length > 0 || free > 0) && (
        <ul className="mt-4 rounded-card border border-line divide-y divide-line overflow-hidden">
          {item.planned.map((meal) => (
            <li key={meal.entryId}>
              <Link href={`/plans/${meal.planId}#day-${meal.dayIndex}`} className={row}>
                <Icon name="calendar" className="size-5 text-ink-muted" />
                <span className="flex-1">
                  <b>{formatPortions(meal.servings)}</b> for {dayAndMeal(meal)}
                </span>
                <Icon name="chevron-right" className="size-5 text-ink-subtle" />
              </Link>
            </li>
          ))}
          {item.planned.length > 0 && free > 0 && <li className="px-3 py-2.5 text-sm text-ink-muted">{formatPortions(free)} not planned</li>}
        </ul>
      )}

      {storage.notes && (
        <div className="mt-3 rounded-card bg-surface-2 p-3 text-sm">
          <p className="text-xs text-ink-muted">From the recipe</p>
          <p className="mt-1">{storage.notes}</p>
        </div>
      )}

      <div className={cx("mt-4 grid gap-2", plans.length > 0 && free >= MIN_PORTIONS && "grid-cols-2")}>
        {plans.length > 0 && free >= MIN_PORTIONS && (
          <button
            type="button"
            onClick={() => setMode("planning")}
            className={cx("h-14 rounded-control border border-line flex flex-col items-center justify-center text-sm font-medium hover:bg-surface-2", focus)}
          >
            <Icon name="calendar" className="size-5" />
            Plan it
          </button>
        )}
        <Link
          href={`/recipes/${item.recipe.slug}`}
          className={cx("h-14 rounded-control border border-line flex flex-col items-center justify-center text-sm font-medium hover:bg-surface-2", focus)}
        >
          <Icon name="book" className="size-5" />
          Recipe
        </Link>
      </div>
      {!item.goingIn && (
        <button
          type="button"
          onClick={planned > 0 ? () => setMode("removing") : remove}
          className={buttonClasses("ghost", "mt-2 w-full text-danger")}
        >
          Take it all out
        </button>
      )}
    </Sheet>
  );
}
