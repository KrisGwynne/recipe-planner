"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icon";

const stepButton =
  "size-11 grid place-items-center rounded-full disabled:text-ink-subtle focus-visible:outline-2 focus-visible:outline-primary";

/**
 * A − value + stepper with its label on the left (foundations; meal plans
 * design C, K and F). With `name`, the value is also sent with its form.
 */
export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  format = String,
  onChange,
  name,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  name?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      </div>
      <div className="shrink-0 flex items-center rounded-full border border-line bg-surface-2">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className={stepButton}
        >
          <Icon name="minus" className="size-5" />
        </button>
        <span aria-live="polite" aria-label={`${label}: ${format(value)}`} className="w-10 text-center text-lg font-semibold tabular-nums">
          {format(value)}
        </span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className={stepButton}
        >
          <Icon name="plus" className="size-5" />
        </button>
      </div>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
