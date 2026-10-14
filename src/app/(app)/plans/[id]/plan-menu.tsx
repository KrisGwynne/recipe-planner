"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { formatDay, meals } from "@/plans/plan";
import { deletePlanAction } from "../actions";
import { PlanSheet, type PlanDetails } from "../plan-sheet";

type Open = "menu" | "edit" | "copy" | "delete" | null;

const row = "w-full min-h-13 py-3 flex items-center gap-3 text-left font-medium";

/**
 * The plan's ⋯ (design J): edit (K), copy to a new plan (C, filled in) and
 * delete (L). "Compare with another plan" waits for PP-174.
 */
export function PlanMenu({
  plan,
  mealsByDay,
  copyStart,
  today,
}: {
  plan: PlanDetails & { id: string };
  mealsByDay: number[];
  copyStart: string;
  today: string;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [deleting, startDelete] = useTransition();
  const mealCount = mealsByDay.reduce((sum, n) => sum + n, 0);
  const close = () => setOpen(null);

  function remove() {
    startDelete(() => deletePlanAction(plan.id));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen("menu")}
        aria-label="More"
        className="size-11 shrink-0 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon name="more" className="size-6" />
      </button>

      {open === "menu" && (
        <Sheet title={plan.name} onClose={close}>
          <ul className="divide-y divide-line">
            <li>
              <button type="button" onClick={() => setOpen("edit")} className={row}>
                <Icon name="pencil" className="size-5 text-ink-muted" />
                Edit name, dates and people
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setOpen("copy")} className={row}>
                <Icon name="copy" className="size-5 text-ink-muted" />
                <span>
                  Copy to a new plan
                  <span className="block text-sm font-normal text-ink-muted">
                    Same meals, starting {formatDay(copyStart)}
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                // An empty plan goes without asking (design L).
                onClick={() => (mealCount > 0 ? setOpen("delete") : remove())}
                disabled={deleting}
                className={`${row} text-danger`}
              >
                <Icon name="trash" className="size-5" />
                Delete plan
              </button>
            </li>
          </ul>
          <button type="button" onClick={close} className="mt-3 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
            Cancel
          </button>
        </Sheet>
      )}

      {open === "edit" && (
        <PlanSheet mode={{ kind: "edit", planId: plan.id, mealsByDay }} initial={plan} today={today} onClose={close} />
      )}

      {open === "copy" && (
        <PlanSheet
          mode={{ kind: "copy", planId: plan.id }}
          initial={{ ...plan, name: `Copy of ${plan.name}`.slice(0, 50), startDate: copyStart }}
          today={today}
          onClose={close}
        />
      )}

      {open === "delete" && (
        <Sheet title={`Delete "${plan.name}"?`} onClose={close}>
          <p className="text-ink-muted">It has {meals(mealCount)} planned. The recipes stay in your library.</p>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className={buttonClasses("danger", "mt-5 w-full")}
          >
            Delete plan
          </button>
          <button type="button" onClick={close} className="mt-2 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
            Cancel
          </button>
        </Sheet>
      )}
    </>
  );
}
