"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { cx } from "@/lib/cx";
import { MAX_DAYS, MAX_PEOPLE, defaultPlanName, formatDay, formatLongDate, formatRange, meals, planDay } from "@/plans/plan";
import { copyPlanAction, createPlanAction, updatePlanAction, type PlanFormState } from "./actions";

export type PlanDetails = { name: string; startDate: string; days: number; people: number };

type Mode =
  | { kind: "create"; startHint?: string }
  | { kind: "copy"; planId: string }
  | { kind: "edit"; planId: string; mealsByDay: number[] };

const actions = { create: createPlanAction, copy: copyPlanAction, edit: updatePlanAction };
const titles = { create: "New plan", copy: "Copy to a new plan", edit: "Edit plan" };
const submitLabels = { create: "Create plan", copy: "Create plan", edit: "Save" };

/**
 * New plan (design C), Copy to a new plan (J) and Edit plan (K): one sheet.
 * A new plan's name follows its start date until it's typed over.
 */
export function PlanSheet({
  mode,
  initial,
  today,
  onClose,
}: {
  mode: Mode;
  initial: PlanDetails;
  today: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [nameEdited, setNameEdited] = useState(mode.kind !== "create");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [days, setDays] = useState(initial.days);
  const [people, setPeople] = useState(initial.people);

  const [state, formAction, pending] = useActionState(async (previous: PlanFormState, formData: FormData) => {
    const result = await actions[mode.kind](previous, formData);
    // A saved edit closes the sheet; create and copy open the new plan.
    if (result.saved) onClose();
    return result;
  }, {});

  function changeStart(value: string) {
    if (!value) return; // Some browsers allow clearing the date; keep the last one.
    setStartDate(value);
    if (!nameEdited) setName(defaultPlanName(value));
  }

  const cut = mode.kind === "edit" ? cutDays(mode.mealsByDay, days, startDate) : null;

  return (
    <Sheet title={titles[mode.kind]} onClose={onClose}>
      <form action={formAction} noValidate className="space-y-5 pt-1">
        {mode.kind !== "create" && <input type="hidden" name="planId" value={mode.planId} />}
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameEdited(true);
            }}
            maxLength={50}
            autoComplete="off"
            aria-invalid={state.errors?.name ? true : undefined}
            aria-describedby={state.errors?.name ? "plan-name-error" : undefined}
            className={cx(
              "mt-1.5 w-full h-12 px-4 rounded-control bg-surface-2 border text-[17px] focus:outline-2 focus:outline-primary",
              state.errors?.name ? "border-2 border-danger" : "border-line",
            )}
          />
          {state.errors?.name && (
            <span id="plan-name-error" role="alert" className="mt-1 flex items-center gap-1.5 text-sm text-danger">
              <Icon name="alert" className="size-4" />
              {state.errors.name}
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium">Starts</span>
          <span className="relative mt-1.5 w-full h-12 px-4 rounded-control bg-surface-2 border border-line text-[17px] flex items-center justify-between focus-within:outline-2 focus-within:outline-primary">
            {formatLongDate(startDate, today)}
            <Icon name="calendar" className="size-5 text-ink-muted" />
            {/* The native date picker, invisible over the field so the date reads as in the design. */}
            <input
              type="date"
              name="startDate"
              value={startDate}
              required
              onChange={(e) => changeStart(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              aria-label="Start date"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </span>
          {state.errors?.startDate ? (
            <span role="alert" className="mt-1 flex items-center gap-1.5 text-sm text-danger">
              <Icon name="alert" className="size-4" />
              {state.errors.startDate}
            </span>
          ) : (
            mode.kind === "create" &&
            mode.startHint && <span className="mt-1 block text-sm text-ink-subtle">{mode.startHint}</span>
          )}
        </label>

        <Stepper
          label="Days"
          name="days"
          hint={formatRange({ startDate, days }, { weekdays: false })}
          value={days}
          min={1}
          max={MAX_DAYS}
          onChange={setDays}
        />

        {cut && (
          <div role="status" className="rounded-card border border-warning/40 bg-warning-soft p-3 text-sm">
            <p className="font-semibold text-warning flex items-center gap-2">
              <Icon name="alert" className="size-5" />
              {meals(cut.meals)} will be removed
            </p>
            <p className="mt-0.5 text-ink">{cut.detail} They&apos;ll be taken out of the plan when you save.</p>
          </div>
        )}

        <Stepper
          label="People"
          name="people"
          hint={
            mode.kind === "edit"
              ? "Leftovers update; nutrition stays per person."
              : "Used to work out leftovers. Nutrition is per person."
          }
          value={people}
          min={1}
          max={MAX_PEOPLE}
          onChange={setPeople}
        />

        {state.errors?.form && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
            <Icon name="alert" className="size-4" />
            {state.errors.form}
          </p>
        )}
        <button type="submit" disabled={pending} className={buttonClasses("primary", "w-full")}>
          {submitLabels[mode.kind]}
        </button>
      </form>
    </Sheet>
  );
}

/**
 * The meals on days a shorter plan cuts off, for the edit sheet's warning
 * (design K): "Sat 17 Oct has 2 meals planned."
 */
export function cutDays(mealsByDay: number[], days: number, startDate: string) {
  const cut = mealsByDay
    .map((count, dayIndex) => ({ count, dayIndex }))
    .filter(({ count, dayIndex }) => dayIndex >= days && count > 0);
  if (cut.length === 0) return null;
  const total = cut.reduce((sum, { count }) => sum + count, 0);
  const names = cut.map(({ dayIndex }) => formatDay(planDay({ startDate }, dayIndex)));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return { meals: total, detail: `${list} ${names.length === 1 ? "has" : "have"} ${meals(total)} planned.` };
}
