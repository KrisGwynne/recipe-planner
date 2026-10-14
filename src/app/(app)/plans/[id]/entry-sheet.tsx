"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { SlotGridSheet } from "@/components/plans/slot-grid-sheet";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import type { PlanEntry } from "@/data";
import { cx } from "@/lib/cx";
import { approx } from "@/lib/format";
import { entryNutrition, grams, leftovers, whole } from "@/plans/nutrition";
import {
  MAX_PORTIONS,
  MIN_PORTIONS,
  formatDay,
  formatPortions,
  mealName,
  planDay,
  recipeServings,
  servings,
  servingsPlanned,
  slotLabels,
} from "@/plans/plan";
import { toPlanGrid } from "@/plans/plan-grid";
import { addEntryAction, moveEntryAction, removeEntryAction, setPortionsAction } from "../actions";
import type { BoardPlan } from "./plan-board";

const tile = "h-14 rounded-control border border-line flex flex-col items-center justify-center text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary";

/**
 * A planned recipe (design F): portions each, saved as they're tapped, then
 * any leftovers and what each person gets (PP-172), then Recipe (scaled to
 * the planned servings), Move (G) and Remove (with Undo).
 */
export function EntrySheet({
  plan,
  entry,
  entries,
  onClose,
}: {
  plan: BoardPlan;
  entry: PlanEntry;
  entries: PlanEntry[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [portions, setPortions] = useState(entry.portionsPerPerson);
  const [moving, setMoving] = useState(false);
  const [, startSaving] = useTransition();
  const where = mealName(plan, entry.dayIndex, entry.slot);
  const people = plan.people === 1 ? "1 person" : `${plan.people} people`;

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
    toast(`Removed from ${where}`, {
      undo: () =>
        void addEntryAction(plan.id, {
          dayIndex: entry.dayIndex,
          slot: entry.slot,
          recipeId: entry.recipe.id,
          portionsPerPerson: portions,
        }),
    });
  }

  if (moving) {
    return (
      <SlotGridSheet
        title="Move to…"
        recipeName={entry.recipe.name}
        verb="Move to"
        grid={toPlanGrid({ ...plan, entries })}
        current={{ dayIndex: entry.dayIndex, slot: entry.slot }}
        portions={{ serves: entry.recipe.serves, each: portions }}
        onChoose={async (_grid, to) => {
          const moved = await moveEntryAction(plan.id, entry.id, to);
          onClose();
          toast(moved ? `Moved to ${mealName(plan, to.dayIndex, to.slot)}` : "Couldn't move that. Try again.");
        }}
        onClose={() => setMoving(false)}
      />
    );
  }

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

      <div className="mt-4">
        <Stepper
          label="Portions each"
          hint={`${people} × ${formatPortions(portions)} = ${servings(servingsPlanned(plan.people, portions))}`}
          value={portions}
          min={MIN_PORTIONS}
          max={MAX_PORTIONS}
          step={0.5}
          format={formatPortions}
          onChange={change}
        />
      </div>

      <Leftovers serves={entry.recipe.serves} people={plan.people} portions={portions} />
      <EachPersonGets entry={{ ...entry, portionsPerPerson: portions }} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Link href={`/recipes/${entry.recipe.slug}?servings=${recipeServings(plan.people, portions)}`} className={tile}>
          <Icon name="book" className="size-5" />
          Recipe
        </Link>
        <button type="button" onClick={() => setMoving(true)} className={tile}>
          <Icon name="move" className="size-5" />
          Move
        </button>
        <button type="button" onClick={remove} className={cx(tile, "text-danger")}>
          <Icon name="trash" className="size-5" />
          Remove
        </button>
      </div>
    </Sheet>
  );
}

/** "1 serving left over / The recipe makes 4; 3 are planned." Not shown without leftovers. */
function Leftovers({ serves, people, portions }: { serves: number; people: number; portions: number }) {
  const n = leftovers(serves, people, portions);
  if (n === 0) return null;
  const planned = servingsPlanned(people, portions);
  return (
    <div role="status" className="mt-4 rounded-card border border-warning/40 bg-warning-soft p-3 text-sm">
      <p className="font-semibold text-warning">{servings(n)} left over</p>
      <p className="mt-0.5 text-ink">
        The recipe makes {serves}; {formatPortions(planned)} {planned <= 1 ? "is" : "are"} planned.
      </p>
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
