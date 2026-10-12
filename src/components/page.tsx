import type { ReactNode } from "react";

/**
 * A tab's page: serif title, then content. Full width on phones, columns on
 * desktop. `aside` sits at the title's right, e.g. the library's "24 recipes".
 */
export function Page({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-5 pt-5 pb-6 md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-[28px] font-semibold">{title}</h1>
        {aside && <div className="shrink-0 text-sm text-ink-muted">{aside}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </main>
  );
}
