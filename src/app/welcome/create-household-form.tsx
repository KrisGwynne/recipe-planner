"use client";

import { useActionState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { createHouseholdAction, type CreateHouseholdState } from "./actions";

const initialState: CreateHouseholdState = { name: "" };

/**
 * Onboarding design B, from the header down to "Create household" (kept in
 * thumb reach at the bottom). `children` is the header.
 */
export function CreateHouseholdForm({ children }: { children: ReactNode }) {
  const [state, formAction, pending] = useActionState(createHouseholdAction, initialState);
  return (
    <form action={formAction} noValidate className="flex-1 flex flex-col">
      <div className="flex-1 px-6 pt-14">
        {children}
        <label className="block mt-6">
          <span className="font-semibold">Household name</span>
          <input
            name="name"
            defaultValue={state.name}
            key={state.name}
            placeholder="e.g. Our kitchen"
            maxLength={50}
            autoComplete="off"
            aria-invalid={state.error ? true : undefined}
            aria-describedby="household-name-hint"
            className={cx(
              "mt-2 w-full h-12 px-4 rounded-control bg-surface border-2 text-[17px] placeholder:text-ink-subtle",
              "focus:outline-none focus:border-primary",
              state.error ? "border-danger" : "border-line",
            )}
          />
          {state.error ? (
            <span id="household-name-hint" role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
              <Icon name="alert" className="size-4" />
              {state.error}
            </span>
          ) : (
            <span id="household-name-hint" className="mt-1.5 block text-sm text-ink-subtle">
              Only members see this. You can change it later.
            </span>
          )}
        </label>
        <div className="mt-8 rounded-control bg-surface-2 px-4 py-3 text-sm flex gap-3">
          <Icon name="link" className="size-5 shrink-0 text-ink-muted" />
          <span>
            <span className="font-semibold">Joining someone else&apos;s?</span>{" "}
            <span className="text-ink-muted">Open the invite link they sent you instead.</span>
          </span>
        </div>
      </div>
      <div className="px-6 pt-6">
        <button type="submit" disabled={pending} className={buttonClasses("primary", "w-full")}>
          Create household
        </button>
      </div>
    </form>
  );
}
