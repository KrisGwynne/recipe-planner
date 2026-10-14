"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { NoPlans, SlotGridSheet, type PlanOption } from "@/components/plans/slot-grid-sheet";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { mealName } from "@/plans/plan";
import { addEntryAction, removeEntryAction } from "../../plans/actions";
import { PlanSheet, type PlanDetails } from "../../plans/plan-sheet";

/**
 * The recipe page's action bar, in place of the tab bar on phones (recipe
 * design A), with Add to plan (meal plans design G). Cooked today joins it
 * with PP-169. Offers the plan covering today, then the ones to come.
 */
export function AddToPlan({
  recipe,
  plans,
  newPlan,
  today,
}: {
  recipe: { id: string; name: string; mealType: string[]; serves: number };
  plans: PlanOption[];
  /** The New plan sheet's starting values, for when there are no plans. */
  newPlan: PlanDetails;
  today: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState<"grid" | "new" | null>(null);
  const close = () => setOpen(null);

  return (
    <>
      <div aria-hidden="true" className="hidden md:block h-24" />
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:left-20">
        <div className="mx-auto max-w-xl flex gap-3">
          <button type="button" onClick={() => setOpen("grid")} className={buttonClasses("primary", "flex-1")}>
            <Icon name="calendar" className="size-5" />
            Add to plan
          </button>
        </div>
      </div>

      {open === "grid" && plans.length === 0 && (
        <Sheet title="Add to plan" onClose={close}>
          <NoPlans>
            <button type="button" onClick={() => setOpen("new")} className={buttonClasses("primary", "mt-5 w-full")}>
              <Icon name="plus" className="size-5" />
              Create a plan
            </button>
          </NoPlans>
        </Sheet>
      )}
      {open === "grid" && plans.length > 0 && (
        <SlotGridSheet
          title="Add to plan"
          recipeName={recipe.name}
          verb="Add to"
          grid={null}
          plans={plans}
          boldSlots={recipe.mealType}
          portions={{ serves: recipe.serves, each: 1 }}
          onChoose={async (grid, cell) => {
            const id = await addEntryAction(grid.id, { ...cell, recipeId: recipe.id });
            close();
            if (!id) {
              toast("Couldn't add that recipe. Try again.");
              return;
            }
            toast(`Added to ${mealName(grid, cell.dayIndex, cell.slot)}`, {
              undo: () => void removeEntryAction(grid.id, id),
            });
          }}
          onClose={close}
        />
      )}
      {open === "new" && <PlanSheet mode={{ kind: "create" }} initial={newPlan} today={today} onClose={close} />}
    </>
  );
}
