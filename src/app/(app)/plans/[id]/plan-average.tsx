import Link from "next/link";
import { Icon } from "@/components/icon";
import { cx } from "@/lib/cx";
import { grams, whole, type Totals } from "@/plans/nutrition";
import { approx } from "@/lib/format";

const focus = "focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Each person's day on average (design D), opening the nutrition page (H).
 * A phone card above the day strip; from md, a link in the header (wide
 * design). Estimated averages get the ~ and dashed outline.
 */
export function PlanAverage({ planId, average, wide = false }: { planId: string; average: Totals; wide?: boolean }) {
  const e = average.estimated;
  const outline = e ? "border-dashed border-ink-subtle" : "border-line";
  const kcal = approx(whole(average.kcal), e);
  const href = `/plans/${planId}/nutrition`;

  if (wide) {
    return (
      <Link
        href={href}
        className={cx("shrink-0 rounded-control border bg-surface px-4 py-2 text-sm tabular-nums hover:bg-surface-2", outline, focus)}
      >
        <span className="text-ink-muted">A day, each:</span> <b className={cx(e && "text-ink-muted")}>{kcal} kcal</b>{" "}
        <span className="text-ink-muted">
          · P {grams(average.proteinG, e)} · C {grams(average.carbsG, e)} · F {grams(average.fatG, e)}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cx("flex items-center gap-3 rounded-card bg-surface border px-4 py-3 hover:bg-surface-2", outline, focus)}
    >
      <span className="flex-1">
        <span className="block text-xs text-ink-muted">Each person, a day on average</span>
        <span className="block mt-0.5 tabular-nums">
          <span className={cx("text-xl font-semibold", e && "text-ink-muted")}>{kcal}</span>{" "}
          <span className="text-ink-muted">kcal</span>
          <span className="ml-3 text-sm text-ink-muted">
            P <b className="text-ink">{grams(average.proteinG, e)}</b> · C <b className="text-ink">{grams(average.carbsG, e)}</b> · F{" "}
            <b className="text-ink">{grams(average.fatG, e)}</b>
          </span>
        </span>
      </span>
      <Icon name="chevron-right" className="size-5 text-ink-subtle" />
    </Link>
  );
}
