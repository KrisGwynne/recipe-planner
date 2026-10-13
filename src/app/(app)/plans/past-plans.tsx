"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";

/** Past plans, newest first: the latest shown, the rest behind "Show N older plans" (design A). */
export function PastPlans({ plans }: { plans: { id: string; name: string; detail: string }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? plans : plans.slice(0, 1);
  const hidden = plans.length - shown.length;
  return (
    <div className="rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
      {shown.map((plan) => (
        <Link
          key={plan.id}
          href={`/plans/${plan.id}`}
          className="flex items-center gap-3 px-4 min-h-14 py-2.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <span className="flex-1 min-w-0">
            <span className="block font-semibold truncate">{plan.name}</span>
            <span className="block text-sm text-ink-muted tabular-nums">{plan.detail}</span>
          </span>
          <Icon name="chevron-right" className="size-5 text-ink-subtle" />
        </Link>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="w-full h-12 text-sm font-semibold text-primary hover:bg-surface-2"
        >
          {hidden === 1 ? "Show 1 older plan" : `Show ${hidden} older plans`}
        </button>
      )}
    </div>
  );
}
