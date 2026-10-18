"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { SlotGridSheet, type Cell } from "@/components/plans/slot-grid-sheet";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import type { LeftoversSource, PlanEntry } from "@/data";
import { cx } from "@/lib/cx";
import { approx } from "@/lib/format";
import {
  maxCookPortions,
  maxLeftoverPortions,
  overPlanned,
  plannedLeftovers,
  startingPortions,
  unplanned,
} from "@/plans/leftovers";
import { andList, entryNutrition, grams, whole } from "@/plans/nutrition";
import {
  MIN_PORTIONS,
  SLOTS,
  formatDay,
  formatPortions,
  mealName,
  planDay,
  recipeServings,
  servings,
  servingsPlanned,
  slotLabels,
  type Slot,
} from "@/plans/plan";
import { toPlanGrid } from "@/plans/plan-grid";
import { addEntryAction, addLeftoversAction, moveEntryAction, removeEntryAction, setPortionsAction } from "../actions";
import type { BoardPlan, NextPlan } from "./plan-board";

const tile = "h-14 rounded-control border border-line flex flex-col items-center justify-center text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary";

const row = "w-full flex items-center gap-3 px-3 min-h-12 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";

/** A meal's place in a plan, to keep leftovers after their cook. */
function order(cell: Cell): number {
  return cell.dayIndex * SLOTS.length + SLOTS.indexOf(cell.slot);
}

/** "Thu 15 lunch". */
function dayAndMeal(meal: { date: string; slot: Slot }): string {
  return `${formatDay(meal.date).split(" ").slice(0, 2).join(" ")} ${meal.slot}`;
}

/**
 * A planned recipe (meal plans design F, leftovers design B and E): portions
 * each, saved as they're tapped, then its leftovers (a cook: where they go,
 * with Plan them for the rest) or where it comes from (a leftovers meal),
 * what each person gets, then Recipe (scaled to the planned servings), Move
 * (G) and Remove (with Undo, or asking first when leftovers are planned
 * from it, design L).
 */
export function EntrySheet({
  plan,
  next,
  entry,
  entries,
  onOpen,
  onClose,
}: {
  plan: BoardPlan;
  next: NextPlan;
  entry: PlanEntry;
  entries: PlanEntry[];
  onOpen: (entryId: string) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [portions, setPortions] = useState(entry.portionsPerPerson);
  const [mode, setMode] = useState<"sheet" | "moving" | "planning" | "removing">("sheet");
  const [, startSaving] = useTransition();
  const where = mealName(plan, entry.dayIndex, entry.slot);
  const people = plan.people === 1 ? "1 person" : `${plan.people} people`;
  const from = entry.leftoversOf;
  const current = { ...entry, portionsPerPerson: portions };
  const max = from ? maxLeftoverPortions(entry, plan.people) : maxCookPortions(entry, plan.people);
  const notPlanned = unplanned(current, plan.people);

  function change(value: number) {
    setPortions(value);
    startSaving(async () => {
      if (!(await setPortionsAction(plan.id, entry.id, value))) toast("Couldn't save the portions. Try again.");
    });
  }

  async function remove() {
    onClose();
    if (!(await removeEntryAction(plan.id, entry.id))) {
      toast("Couldn't remove that. Try again.");
      return;
    }
    // Leftovers meals planned from a cook go with it; the sheet asked first, so there's no Undo.
    if (entry.leftoversTo.length > 0) {
      toast(`Removed from ${where}`);
      return;
    }
    const at = { dayIndex: entry.dayIndex, slot: entry.slot, portionsPerPerson: portions };
    toast(`Removed from ${where}`, {
      undo: () =>
        void (from
          ? addLeftoversAction(plan.id, { ...at, cookId: from.entryId })
          : addEntryAction(plan.id, { ...at, recipeId: entry.recipe.id })),
    });
  }

  if (mode === "moving") {
    // A leftovers meal stays after its cook; a cook before its leftovers.
    const cookHere = from && from.planId === plan.id ? entries.find((e) => e.id === from.entryId) : undefined;
    const firstLeftovers = entry.leftoversTo.filter((m) => m.planId === plan.id).map(order);
    return (
      <SlotGridSheet
        title="Move to…"
        recipeName={entry.recipe.name}
        verb="Move to"
        grid={toPlanGrid({ ...plan, entries })}
        current={{ dayIndex: entry.dayIndex, slot: entry.slot }}
        portions={{ serves: entry.recipe.serves, each: portions }}
        blocked={(_grid, cell) =>
          (cookHere !== undefined && order(cell) <= order(cookHere)) ||
          (firstLeftovers.length > 0 && order(cell) >= Math.min(...firstLeftovers))
        }
        onChoose={async (_grid, to) => {
          const moved = await moveEntryAction(plan.id, entry.id, to);
          onClose();
          toast(moved ? `Moved to ${mealName(plan, to.dayIndex, to.slot)}` : "Couldn't move that. Try again.");
        }}
        onClose={() => setMode("sheet")}
      />
    );
  }

  if (mode === "planning") {
    return (
      <SlotGridSheet
        title="Plan the leftovers"
        recipeName={`${entry.recipe.name} · ${formatPortions(notPlanned)} left from ${where}`}
        verb="Add to"
        grid={toPlanGrid({ ...plan, entries })}
        plans={next ? [plan, next] : undefined}
        portions={{ serves: entry.recipe.serves, each: portions }}
        blocked={(grid, cell) => grid.id === plan.id && order(cell) <= order(entry)}
        marker={(grid, cell) => (grid.id === plan.id && order(cell) === order(entry) ? "Cook" : undefined)}
        leftovers={{ left: notPlanned }}
        onChoose={async (grid, to, each) => {
          const id = await addLeftoversAction(grid.id, { ...to, cookId: entry.id, portionsPerPerson: each });
          setMode("sheet");
          toast(id ? `Added to ${mealName(grid, to.dayIndex, to.slot)}` : "Couldn't add the leftovers. Try again.");
        }}
        onClose={() => setMode("sheet")}
      />
    );
  }

  if (mode === "removing") {
    const meals = entry.leftoversTo.map(dayAndMeal);
    return (
      <Sheet title={`Remove ${where}?`} onClose={() => setMode("sheet")}>
        <p className="text-ink-muted">
          Its leftovers are planned for {andList(meals)}. Removing the {entry.recipe.name.toLowerCase()} removes{" "}
          {meals.length === 1 ? "that" : "those"} too.
        </p>
        <button type="button" onClick={remove} className={buttonClasses("danger", "mt-5 w-full")}>
          Remove all
        </button>
        <button type="button" onClick={() => setMode("sheet")} className={buttonClasses("ghost", "mt-2 w-full")}>
          Cancel
        </button>
      </Sheet>
    );
  }

  const planned = servingsPlanned(plan.people, portions);
  return (
    <Sheet
      title={entry.recipe.name}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={buttonClasses("primary", "w-full")}>
          Done
        </button>
      }
    >
      <p className="-mt-1 text-sm text-ink-muted">
        {formatDay(planDay(plan, entry.dayIndex))} · {slotLabels[entry.slot]}
      </p>

      {from && <Source plan={plan} from={from} onOpen={onOpen} />}

      <div className="mt-4">
        <Stepper
          label="Portions each"
          hint={
            from ? (
              `${people} × ${formatPortions(portions)} = ${formatPortions(planned)}${portions >= max ? ", all that's left" : ""}`
            ) : (
              <>
                {people} × {formatPortions(portions)} = {servings(planned)}
                {portions >= max && entry.leftoversTo.length > 0 && (
                  <span className="block">
                    {formatPortions(plannedLeftovers(entry))} {plannedLeftovers(entry) <= 1 ? "is" : "are"} planned as leftovers
                  </span>
                )}
              </>
            )
          }
          value={portions}
          min={MIN_PORTIONS}
          max={max}
          step={0.5}
          format={formatPortions}
          onChange={change}
        />
      </div>

      {!from && (
        <Leftovers
          plan={plan}
          entry={current}
          notPlanned={notPlanned}
          onOpen={onOpen}
          onPlan={() => setMode("planning")}
        />
      )}
      <EachPersonGets entry={current} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Link href={`/recipes/${entry.recipe.slug}?servings=${recipeServings(plan.people, portions)}`} className={tile}>
          <Icon name="book" className="size-5" />
          Recipe
        </Link>
        <button type="button" onClick={() => setMode("moving")} className={tile}>
          <Icon name="move" className="size-5" />
          Move
        </button>
        <button
          type="button"
          onClick={entry.leftoversTo.length > 0 ? () => setMode("removing") : remove}
          className={cx(tile, "text-danger")}
        >
          <Icon name="trash" className="size-5" />
          Remove
        </button>
      </div>
    </Sheet>
  );
}

/** Where a leftovers meal comes from (leftovers design E): the cook, in this plan (opens its sheet) or the one before. */
function Source({ plan, from, onOpen }: { plan: BoardPlan; from: LeftoversSource; onOpen: (entryId: string) => void }) {
  const content = (
    <>
      <Icon name="leftovers" className="size-5 text-ink-muted" />
      <span className="flex-1 text-sm">
        Leftovers from <b>{dayAndMeal(from)}</b>
      </span>
      <Icon name="chevron-right" className="size-5 text-ink-subtle" />
    </>
  );
  const classes = cx(row, "mt-3 rounded-control bg-surface-2");
  return from.planId === plan.id ? (
    <button type="button" onClick={() => onOpen(from.entryId)} className={classes}>
      {content}
    </button>
  ) : (
    <Link href={`/plans/${from.planId}`} className={classes}>
      {content}
    </Link>
  );
}

/**
 * A cook's leftovers (leftovers design B): what's left over, each leftovers
 * meal planned from it (tap to open it), then, in amber, what isn't planned
 * yet with Plan them, or what's planned past what's left. Not shown when it
 * leaves nothing over.
 */
function Leftovers({
  plan,
  entry,
  notPlanned,
  onOpen,
  onPlan,
}: {
  plan: BoardPlan;
  entry: PlanEntry;
  notPlanned: number;
  onOpen: (entryId: string) => void;
  onPlan: () => void;
}) {
  const eaten = servingsPlanned(plan.people, entry.portionsPerPerson);
  const left = Math.max(0, entry.recipe.serves - eaten);
  if (left === 0 && entry.leftoversTo.length === 0) return null;
  const canPlan = startingPortions(notPlanned, plan.people) !== null;
  return (
    <div role="status" className="mt-4 rounded-card border border-line overflow-hidden">
      <div className="px-3 pt-3 pb-2">
        <p className="font-semibold">{servings(left)} left over</p>
        <p className="text-sm text-ink-muted">
          The recipe makes {entry.recipe.serves}; {formatPortions(eaten)} {eaten <= 1 ? "is" : "are"} eaten at this meal.
        </p>
      </div>
      {entry.leftoversTo.length > 0 && (
        <ul>
          {entry.leftoversTo.map((meal) => {
            const content = (
              <>
                <Icon name="leftovers" className="size-5 text-ink-muted" />
                <span className="flex-1">
                  <b>{formatPortions(meal.servings)}</b> for {dayAndMeal(meal)}
                </span>
                <Icon name="chevron-right" className="size-5 text-ink-subtle" />
              </>
            );
            return (
              <li key={meal.entryId} className="border-t border-line">
                {meal.planId === plan.id ? (
                  <button type="button" onClick={() => onOpen(meal.entryId)} className={row}>
                    {content}
                  </button>
                ) : (
                  <Link href={`/plans/${meal.planId}#day-${meal.dayIndex}`} className={row}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {notPlanned > 0 && (
        <div className="px-3 py-3 border-t border-line bg-warning-soft">
          <p className="font-semibold text-warning">{formatPortions(notPlanned)} not planned yet</p>
          {canPlan && (
            <button type="button" onClick={onPlan} className={buttonClasses("secondary", "mt-2 w-full bg-surface")}>
              <Icon name="calendar" className="size-5" />
              Plan them
            </button>
          )}
        </div>
      )}
      {notPlanned < 0 && (
        <div className="px-3 py-3 border-t border-line bg-warning-soft">
          <p className="font-semibold text-warning">{overPlanned(notPlanned)}</p>
          <p className="text-sm text-ink">Fewer portions here or in the leftovers meals will fix it.</p>
        </div>
      )}
    </div>
  );
}

/** Nutrition per serving × portions each, with the printed tick or the estimated ~. */
function EachPersonGets({ entry }: { entry: PlanEntry }) {
  const n = entryNutrition(entry);
  const e = n.estimated;
  return (
    <div className={cx("mt-4 rounded-card bg-surface-2 p-3", e && "border border-dashed border-ink-subtle")}>
      <div className="flex items-center gap-2">
        <p className="text-xs text-ink-muted">Each person gets</p>
        {e ? (
          <span className="inline-flex items-center h-6 px-2 rounded-full border border-dashed border-ink-subtle text-ink-muted text-xs font-medium">
            ~ Estimated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-surface text-xs font-medium">
            <Icon name="check" className="size-3.5" strokeWidth={2.5} />
            Printed
          </span>
        )}
      </div>
      <p className="mt-1 tabular-nums">
        <span className={cx("text-2xl font-semibold", e && "text-ink-muted")}>{approx(whole(n.kcal), e)}</span>{" "}
        <span className="text-ink-muted">kcal</span>
      </p>
      <p className="text-sm text-ink-muted tabular-nums">
        Protein <b className="text-ink">{grams(n.proteinG, e)}</b> · Carbs <b className="text-ink">{grams(n.carbsG, e)}</b> · Fat{" "}
        <b className="text-ink">{grams(n.fatG, e)}</b>
      </p>
    </div>
  );
}
