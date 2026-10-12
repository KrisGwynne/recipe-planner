import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card bg-surface border border-line p-8 text-center">
      <span className="mx-auto size-14 rounded-full bg-primary-soft text-primary grid place-items-center">
        <Icon name={icon} className="size-7" />
      </span>
      <p className="font-display text-xl font-semibold mt-4">{title}</p>
      {children && <p className="text-ink-muted mt-1">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
