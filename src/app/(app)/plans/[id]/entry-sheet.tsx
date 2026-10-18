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
import { MAX_FROZEN, frozenLabel } from "@/plans/freezer";
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
  formatShortDate,
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
import { addFromFreezerAction, freezeLeftoversAction, unfreezeLeftoversAction } from "../freezer/actions";
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
 * from it or going in the freezer, design L). A cook's leftovers can be
 * frozen (design F, PP-189); a meal from the freezer says so (design E).
 */
export function EntrySheet({
  today,
  plan,
  next,
  entry,
  entries,
  onOpen,
  onClose,
}: {
  today: string;
  plan: BoardPlan;
  next: NextPlan;
  entry: PlanEntry;
  entries: PlanEntry[];
  onOpen: (entryId: string) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [portions, setPortions] = useState(entry.portionsPerPerson);
  const [mode, setMode] = useState<"sheet" | "moving" | "planning" | "freezing" | "removing">("sheet");
  const [, startSaving] = useTransition();
  const where = mealName(plan, entry.dayIndex, entry.slot);
  const people = plan.people === 1 ? "1 person" : `${plan.people} people`;
  const from = entry.leftoversOf;
  const freezer = entry.fromFreezer;
  // Frozen leftovers still to go in go with the cook (design L); ones already in stay.
  const goingIn = entry.frozen && entry.frozen.frozenOn > today ? entry.frozen : null;
  const asksFirst = entry.leftoversTo.length > 0 || goingIn !== null;
  const current = { ...entry, portionsPerPerson: portions };
  const max = from || freezer ? maxLeftoverPortions(entry, plan.people) : maxCookPortions(entry, plan.people);
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
    if (asksFirst) {
      toast(`Removed from ${where}`);
      return;
    }
    const at = { dayIndex: entry.dayIndex, slot: entry.slot, portionsPerPerson: portions };
    toast(`Removed from ${where}`, {
      undo: () =>
        void (from
          ? addLeftoversAction(plan.id, { ...at, cookId: from.entryId })
          : freezer
            ? addFromFreezerAction(plan.id, { ...at, itemId: freezer.itemId })
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
          (freezer !== null && planDay(plan, cell.dayIndex) < freezer.frozenOn) ||
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

  if (mode === "freezing") {
    return (
      <FreezeSheet
        entry={entry}
        when={`${formatDay(planDay(plan, entry.dayIndex))}, after ${entry.slot}`}
        where={`${dayAndMeal({ date: planDay(plan, entry.dayIndex), slot: entry.slot })}`}
        most={notPlanned + (entry.frozen?.servings ?? 0)}
        onDone={() => setMode("sheet")}
      />
    );
  }

  if (mode === "removing") {
    const meals = entry.leftoversTo.map(dayAndMeal);
    const parts = [
      ...(meals.length > 0 ? [`its leftovers are planned for ${andList(meals)}`] : []),
      ...(goingIn ? [`${servings(goingIn.servings)} ${goingIn.servings <= 1 ? "is" : "are"} going in the freezer`] : []),
    ];
    const sentence = andList(parts);
    return (
      <Sheet title={`Remove ${where}?`} onClose={() => setMode("sheet")}>
        <p className="text-ink-muted">
          {sentence.charAt(0).toUpperCase() + sentence.slice(1)}. Removing the {entry.recipe.name.toLowerCase()} removes{" "}
          {meals.length + (goingIn ? 1 : 0) === 1 ? "that" : "those"} too.
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
      {freezer && (
        <Link href="/plans/freezer" className={cx(row, "mt-3 rounded-control bg-surface-2")}>
          <Icon name="snow" className="size-5 text-ink-muted" />
          <span className="flex-1 text-sm">
            From the freezer · frozen {formatShortDate(freezer.frozenOn, today)}
          </span>
          <Icon name="chevron-right" className="size-5 text-ink-subtle" />
        </Link>
      )}

      <div className="mt-4">
        <Stepper
          label="Portions each"
          hint={
            from || freezer ? (
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

      {!from && !freezer && (
        <Leftovers
          plan={plan}
          today={today}
          entry={current}
          notPlanned={notPlanned}
          onOpen={onOpen}
          onPlan={() => setMode("planning")}
          onFreeze={() => setMode("freezing")}
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
          onClick={asksFirst ? () => setMode("removing") : remove}
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
 * meal planned from it (tap to open it) and what's frozen (tap to change it),
 * then, in amber, what isn't planned yet with Plan them and Freeze, or
 * what's planned past what's left. Not shown when it leaves nothing over.
 */
function Leftovers({
  plan,
  today,
  entry,
  notPlanned,
  onOpen,
  onPlan,
  onFreeze,
}: {
  plan: BoardPlan;
  today: string;
  entry: PlanEntry;
  notPlanned: number;
  onOpen: (entryId: string) => void;
  onPlan: () => void;
  onFreeze: () => void;
}) {
  const eaten = servingsPlanned(plan.people, entry.portionsPerPerson);
  const left = Math.max(0, entry.recipe.serves - eaten);
  if (left === 0 && entry.leftoversTo.length === 0 && !entry.frozen) return null;
  const canPlan = startingPortions(notPlanned, plan.people) !== null;
  const canFreeze = notPlanned >= MIN_PORTIONS && !entry.frozen;
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
      {entry.frozen && (
        <button type="button" onClick={onFreeze} className={cx(row, "border-t border-line")}>
          <Icon name="snow" className="size-5 text-ink-muted" />
          <span className="flex-1">
            <b>{formatPortions(entry.frozen.servings)}</b> {frozenLabel(entry.frozen, today).split(" ").slice(1).join(" ")}
          </span>
          <Icon name="chevron-right" className="size-5 text-ink-subtle" />
        </button>
      )}
      {notPlanned > 0 && (
        <div className="px-3 py-3 border-t border-line bg-warning-soft">
          <p className="font-semibold text-warning">{formatPortions(notPlanned)} not planned yet</p>
          {(canPlan || canFreeze) && (
            <div className={cx("mt-2 grid gap-2", canPlan && canFreeze && "grid-cols-2")}>
              {canPlan && (
                <button type="button" onClick={onPlan} className={buttonClasses("secondary", "w-full bg-surface")}>
                  <Icon name="calendar" className="size-5" />
                  Plan them
                </button>
              )}
              {canFreeze && (
                <button type="button" onClick={onFreeze} className={buttonClasses("secondary", "w-full bg-surface")}>
                  <Icon name="snow" className="size-5" />
                  Freeze
                </button>
              )}
            </div>
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

/**
 * Freeze the leftovers (leftovers design F): servings start at all that
 * isn't planned (or what's frozen already), in halves. The recipe's storage
 * notes show, or an amber note when it says it doesn't freeze. Opened again
 * from the cook, it changes or undoes the freezing.
 */
function FreezeSheet({
  entry,
  when,
  where,
  most,
  onDone,
}: {
  entry: PlanEntry;
  when: string;
  where: string;
  most: number;
  onDone: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState(entry.frozen?.servings ?? Math.min(most, MAX_FROZEN));
  const [saving, startSaving] = useTransition();
  const storage = entry.recipe.storage;

  function save() {
    startSaving(async () => {
      const id = await freezeLeftoversAction(entry.id, amount);
      onDone();
      toast(id ? `${servings(amount)} to freeze` : "Couldn't freeze them. Try again.");
    });
  }

  function undo() {
    startSaving(async () => {
      const done = await unfreezeLeftoversAction(entry.id);
      onDone();
      toast(done ? "Not freezing them" : "Meals are planned from them, so they stay in the freezer.");
    });
  }

  return (
    <Sheet title="Freeze the leftovers" onClose={onDone}>
      <p className="-mt-1 text-sm text-ink-muted truncate">
        {entry.recipe.name} · {where}
      </p>
      <div className="mt-4">
        <Stepper
          label="Servings"
          hint={`${formatPortions(most)} not planned`}
          value={amount}
          min={MIN_PORTIONS}
          max={Math.min(most, MAX_FROZEN)}
          step={0.5}
          format={formatPortions}
          onChange={setAmount}
        />
      </div>
      <p className="mt-4 text-sm text-ink-muted">They go on the freezer list on {when}.</p>
      {storage.freezable === false ? (
        <div role="note" className="mt-3 rounded-card border border-warning/40 bg-warning-soft p-3 text-sm">
          <p className="font-semibold text-warning flex items-center gap-2">
            <Icon name="alert" className="size-5" />
            The recipe says this doesn&apos;t freeze well
          </p>
          <p className="mt-0.5 text-ink">You can still freeze it.</p>
        </div>
      ) : (
        storage.notes && (
          <div className="mt-3 rounded-card bg-surface-2 p-3 text-sm">
            <p className="text-xs text-ink-muted">From the recipe</p>
            <p className="mt-1">{storage.notes}</p>
          </div>
        )
      )}
      <button type="button" onClick={save} disabled={saving} className={buttonClasses("primary", "mt-6 w-full")}>
        <Icon name="snow" className="size-5" />
        Freeze {servings(amount)}
      </button>
      {entry.frozen ? (
        <button type="button" onClick={undo} disabled={saving} className={buttonClasses("ghost", "mt-2 w-full")}>
          Don&apos;t freeze them
        </button>
      ) : (
        <button type="button" onClick={onDone} className={buttonClasses("ghost", "mt-2 w-full")}>
          Cancel
        </button>
      )}
    </Sheet>
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
