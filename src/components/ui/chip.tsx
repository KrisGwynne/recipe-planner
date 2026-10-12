import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "@/components/icon";

/**
 * A filter option. Selected chips are solid ink with a tick. `count` is how
 * many recipes the option would find; a chip with nothing to find is disabled.
 */
export function FilterChip({
  selected = false,
  count,
  disabled = false,
  onClick,
  children,
}: {
  selected?: boolean;
  count?: number;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "h-10 px-4 rounded-full inline-flex items-center gap-1.5",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected ? "bg-ink text-bg font-semibold" : "border border-line bg-surface-2 font-medium",
        disabled && "text-ink-subtle",
      )}
    >
      {selected && <Icon name="check" className="size-4" strokeWidth={2.5} />}
      {children}
      {/* Space so the accessible name reads "Salmon 5"; flex layout ignores it. */}
      {count !== undefined && " "}
      {count !== undefined && (
        <span className={cx("font-normal tabular-nums", selected ? "opacity-60" : !disabled && "text-ink-subtle")}>
          {count}
        </span>
      )}
    </button>
  );
}

/** An applied filter shown above the results, with a button to remove it. */
export function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="shrink-0 h-9 pl-3 pr-1 rounded-full bg-primary-soft text-primary font-medium inline-flex items-center gap-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="size-7 grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon name="x" className="size-4" />
      </button>
    </span>
  );
}
