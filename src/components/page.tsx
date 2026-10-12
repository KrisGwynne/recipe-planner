import type { ReactNode } from "react";

/** A tab's page: serif title, then content. Full width on phones, columns on desktop. */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-5 pt-5 pb-6 md:p-6">
      <h1 className="font-display text-[28px] font-semibold">{title}</h1>
      <div className="mt-4">{children}</div>
    </main>
  );
}
