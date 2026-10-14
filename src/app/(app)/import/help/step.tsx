import type { ReactNode } from "react";

/**
 * A numbered step card (help design A to C): the number, what to do, and on
 * wider screens the step's button to the right (`action`). `after` spans the
 * whole card, below everything else.
 */
export function Step({
  n,
  title,
  children,
  action,
  after,
}: {
  n: number;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <li className="rounded-card bg-surface border border-line p-4">
      <div className="flex gap-3">
        <span className="size-7 shrink-0 rounded-full bg-primary-soft text-primary grid place-items-center text-sm font-semibold">
          {n}
        </span>
        <div className="flex-1 min-w-0 lg:flex lg:items-start lg:gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">{title}</h3>
            {children}
          </div>
          {action && <div className="mt-3 lg:mt-0 lg:shrink-0">{action}</div>}
        </div>
      </div>
      {after}
    </li>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{children}</h2>;
}
