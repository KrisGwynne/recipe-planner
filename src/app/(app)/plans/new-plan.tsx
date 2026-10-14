"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { PlanSheet, type PlanDetails } from "./plan-sheet";

/**
 * "New plan" and its sheet (design C). On the list it floats above the tab
 * bar in ink, so it doesn't compete with Import (design A); with no plans
 * it's the empty state's one action (design B).
 */
export function NewPlan({
  variant,
  initial,
  today,
  startHint,
}: {
  variant: "floating" | "empty";
  initial: PlanDetails;
  today: string;
  startHint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "floating" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cx(
            "fixed z-30 right-5 bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-8 md:right-8",
            "h-12 pl-4 pr-5 rounded-full bg-ink text-bg font-semibold inline-flex items-center gap-2 shadow-xl",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          <Icon name="plus" className="size-5" strokeWidth={2.5} />
          New plan
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={buttonClasses("primary", "mt-6 w-full")}>
          <Icon name="plus" className="size-5" />
          Create a plan
        </button>
      )}
      {open && (
        <PlanSheet mode={{ kind: "create", startHint }} initial={initial} today={today} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
