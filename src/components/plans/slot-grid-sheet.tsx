"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { categoryDotClasses } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cx } from "@/lib/cx";
import { Stepper } from "@/components/ui/stepper";
import { mostPortions, startingPortions } from "@/plans/leftovers";
import { leftOver, leftovers } from "@/plans/nutrition";
import {
  MIN_PORTIONS,
  SLOTS,
  formatDay,
  formatPortions,
  formatRange,
  mealName,
  planDay,
  servingsPlanned,
  slotLabels,
  type Slot,
} from "@/plans/plan";
import type { PlanGrid } from "@/plans/plan-grid";
import { planGridAction } from "@/app/(app)/plans/actions";

export type PlanOption = { id: string; name: string; startDate: string; days: number };
export type Cell = { dayIndex: number; slot: Slot };

/**
 * "Add to plan" from a recipe page and "Move to…" from a planned recipe
 * (meal plans design G): a grid of the plan's days and meals with a dot per
 * recipe already there. Tap a cell, then the button. With `plans`, the plan
 * button switches between them, loading each plan's grid.
 *
 * "Plan the leftovers" (leftovers design C) uses it too: `blocked` greys out
 * the meals up to the cook, `marker` labels the cook's cell, and with
 * `leftovers` a portions-each stepper replaces the servings line.
 */
export function SlotGridSheet({
  title,
  recipeName,
  verb,
  grid: initialGrid,
  plans,
  boldSlots = [],
  current,
  portions,
  blocked,
  marker,
  leftovers: fromLeftovers,
  onChoose,
  onClose,
}: {
  title: string;
  recipeName: string;
  /** "Add to" or "Move to", before "Tue lunch" on the button. */
  verb: string;
  grid: PlanGrid | null;
  plans?: PlanOption[];
  /** The meals matching the recipe's meal type, in bold. */
  boldSlots?: readonly string[];
  /** Where the recipe being moved is now. */
  current?: Cell;
  /** What the recipe serves and the portions each it's (or will be) planned at, for the leftovers line. */
  portions: { serves: number; each: number };
  /** Meals that can't be chosen (before a leftovers meal's cook, or after a cook's leftovers). */
  blocked?: (grid: PlanGrid, cell: Cell) => boolean;
  /** A word in a cell, such as "Cook". */
  marker?: (grid: PlanGrid, cell: Cell) => string | undefined;
  /** Planning leftovers: the servings the cook has left, shared out by portions each. */
  leftovers?: { left: number };
  onChoose: (grid: PlanGrid, cell: Cell, portionsEach: number) => Promise<void>;
  onClose: () => void;
}) {
  const [grid, setGrid] = useState(initialGrid);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const [failed, setFailed] = useState(false);
  // Portions each for leftovers, starting afresh for each plan's people.
  const [each, setEach] = useState<{ planId: string; value: number } | null>(null);
  const start = grid && fromLeftovers ? startingPortions(fromLeftovers.left, grid.people) : null;
  const portionsEach = fromLeftovers ? (each && each.planId === grid?.id ? each.value : start) : portions.each;

  function fetchGrid(planId: string) {
    startLoading(async () => {
      const next = await planGridAction(planId);
      if (next) setGrid(next);
      else setFailed(true);
    });
  }

  function load(planId: string) {
    setPicking(false);
    setSelected(null);
    setFailed(false);
    fetchGrid(planId);
  }

  // Opened without a grid: load the first plan's.
  const [first] = useState(() => (initialGrid ? undefined : plans?.[0]?.id));
  useEffect(() => {
    // fetchGrid only starts a transition; this runs once, when the sheet opens.
    if (first) fetchGrid(first);
  }, [first]);

  function choose() {
    if (!grid || !selected || portionsEach === null) return;
    startSaving(() => onChoose(grid, selected, portionsEach));
  }

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        grid && !picking ? (
          <button
            type="button"
            onClick={choose}
            disabled={!selected || saving || portionsEach === null}
            className={buttonClasses("primary", "w-full")}
          >
            {selected ? `${verb} ${mealName(grid, selected.dayIndex, selected.slot)}` : "Choose a day and meal"}
          </button>
        ) : undefined
      }
    >
      <p className="-mt-1 text-sm text-ink-muted truncate">{recipeName}</p>

      {plans && plans.length > 1 && grid && (
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-expanded={picking}
          className="mt-3 w-full h-12 px-4 rounded-control bg-surface-2 border border-line flex items-center justify-between text-left focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="truncate">
            <b>{grid.name}</b> <span className="text-ink-muted">· {formatRange(grid, { weekdays: false })}</span>
          </span>
          <Icon name="chevron-down" className={cx("size-5 shrink-0", picking && "rotate-180")} />
        </button>
      )}
      {plans && plans.length === 1 && grid && (
        <p className="mt-3">
          <b>{grid.name}</b> <span className="text-ink-muted">· {formatRange(grid, { weekdays: false })}</span>
        </p>
      )}

      {picking && plans ? (
        <ul className="mt-2 divide-y divide-line" aria-label="Plans">
          {plans.map((plan) => (
            <li key={plan.id}>
              <button
                type="button"
                onClick={() => load(plan.id)}
                aria-pressed={plan.id === grid?.id}
                className="w-full min-h-12 py-2 flex items-center justify-between text-left"
              >
                <span>
                  <span className="block font-semibold">{plan.name}</span>
                  <span className="block text-sm text-ink-muted">{formatRange(plan)}</span>
                </span>
                {plan.id === grid?.id && <Icon name="check" className="size-5 text-primary" strokeWidth={2.5} />}
              </button>
            </li>
          ))}
        </ul>
      ) : loading || (!grid && !failed) ? (
        <p className="mt-6 text-center text-ink-muted" role="status">
          Loading the plan…
        </p>
      ) : failed || !grid ? (
        <p className="mt-6 text-center text-ink-muted">That plan no longer exists.</p>
      ) : (
        <>
          <Grid
            grid={grid}
            boldSlots={boldSlots}
            current={current}
            selected={selected}
            blocked={blocked}
            marker={marker}
            onSelect={setSelected}
          />
          {fromLeftovers ? (
            <LeftoversPortions
              left={fromLeftovers.left}
              people={grid.people}
              each={portionsEach}
              onChange={(value) => setEach({ planId: grid.id, value })}
            />
          ) : (
            <ServingsLine serves={portions.serves} people={grid.people} each={portions.each} />
          )}
        </>
      )}
    </Sheet>
  );
}

function Grid({
  grid,
  boldSlots,
  current,
  selected,
  blocked,
  marker,
  onSelect,
}: {
  grid: PlanGrid;
  boldSlots: readonly string[];
  current?: Cell;
  selected: Cell | null;
  blocked?: (grid: PlanGrid, cell: Cell) => boolean;
  marker?: (grid: PlanGrid, cell: Cell) => string | undefined;
  onSelect: (cell: Cell) => void;
}) {
  return (
    <table className="mt-3 w-full text-sm table-fixed">
      <thead>
        <tr className="text-xs text-ink-muted">
          <th className="w-16">
            <span className="sr-only">Day</span>
          </th>
          {SLOTS.map((slot) => (
            <th key={slot} scope="col" className={cx("pb-1", boldSlots.includes(slot) ? "font-semibold text-ink" : "font-medium")}>
              {slotLabels[slot]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: grid.days }, (_, dayIndex) => {
          const date = planDay(grid, dayIndex);
          const [weekday, day] = formatDay(date).split(" ");
          return (
            <tr key={date}>
              <th scope="row" className="py-0.5 text-left font-medium">
                {weekday} <span className="text-ink-muted font-normal">{day}</span>
              </th>
              {SLOTS.map((slot) => {
                const dots = grid.cells.filter((c) => c.dayIndex === dayIndex && c.slot === slot);
                const isSelected = selected?.dayIndex === dayIndex && selected.slot === slot;
                const isCurrent = current?.dayIndex === dayIndex && current.slot === slot;
                const isBlocked = blocked?.(grid, { dayIndex, slot }) ?? false;
                const label = marker?.(grid, { dayIndex, slot });
                const planned = dots.length === 0 ? "nothing planned" : dots.length === 1 ? "1 recipe planned" : `${dots.length} recipes planned`;
                return (
                  <td key={slot} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => onSelect({ dayIndex, slot })}
                      disabled={isBlocked}
                      aria-pressed={isSelected}
                      aria-label={`${formatDay(date)}, ${slot}: ${label ? label.toLowerCase() : isCurrent ? "here now" : planned}`}
                      className={cx(
                        "w-full h-10 rounded-lg grid place-items-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                        label
                          ? "bg-ink text-bg text-[11px] font-semibold"
                          : isSelected
                            ? "bg-primary text-on-primary"
                            : isBlocked
                              ? "bg-surface-2 opacity-40"
                              : dots.length > 0
                                ? "bg-surface-2"
                                : "border border-dashed border-line",
                        isCurrent && !isSelected && !label && "ring-2 ring-ink-subtle ring-inset",
                      )}
                    >
                      {label ? (
                        label
                      ) : isSelected ? (
                        <Icon name="check" className="size-5" strokeWidth={2.5} />
                      ) : (
                        <span className="flex gap-1" aria-hidden="true">
                          {dots.slice(0, 3).map((dot) => (
                            <span key={dot.entryId} className={cx("size-2.5 rounded-full", categoryDotClasses(dot.category)[0])} />
                          ))}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** "Serves 4 · 2 people × 1 each = 2 · 2 left over", for the chosen plan's people (design G). */
function ServingsLine({ serves, people, each }: { serves: number; people: number; each: number }) {
  const left = leftovers(serves, people, each);
  return (
    <p className="mt-3 text-sm text-ink-muted tabular-nums">
      Serves {serves} · {people === 1 ? "1 person" : `${people} people`} × {formatPortions(each)} each ={" "}
      {formatPortions(servingsPlanned(people, each))}
      {left > 0 && (
        <>
          {" · "}
          <span className="text-warning font-semibold">{leftOver(left)}</span>
        </>
      )}
    </p>
  );
}

/**
 * Portions each for leftovers (leftovers design C): "2 × 1 = 2 · 2 still
 * left", up to what's left. When there isn't ½ each for this plan's people,
 * it says so instead.
 */
function LeftoversPortions({
  left,
  people,
  each,
  onChange,
}: {
  left: number;
  people: number;
  each: number | null;
  onChange: (value: number) => void;
}) {
  if (each === null) {
    return (
      <p className="mt-3 text-sm text-ink-muted" role="status">
        {formatPortions(left)} left isn&apos;t enough for {people === 1 ? "1 person" : `${people} people`} to have ½ each.
      </p>
    );
  }
  const rest = left - servingsPlanned(people, each);
  return (
    <div className="mt-3">
      <Stepper
        label="Portions each"
        hint={
          <>
            {people} × {formatPortions(each)} = {formatPortions(servingsPlanned(people, each))}
            {rest > 0 ? (
              <>
                {" · "}
                <span className="text-warning font-semibold">{formatPortions(rest)} still left</span>
              </>
            ) : (
              ", all that's left"
            )}
          </>
        }
        value={each}
        min={MIN_PORTIONS}
        max={mostPortions(left, people)}
        step={0.5}
        format={formatPortions}
        onChange={onChange}
      />
    </div>
  );
}

/** With no plans, "Add to plan" says so and offers to make one (design G). */
export function NoPlans({ children }: { children: ReactNode }) {
  return (
    <div className="pt-2 pb-2 text-center">
      <p className="font-display text-xl font-semibold">No meal plans yet</p>
      <p className="text-ink-muted mt-1">Make a plan, then add this recipe to a day and meal.</p>
      {children}
    </div>
  );
}
