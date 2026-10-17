import type { ReactNode } from "react";
import { BackButton } from "./back-button";

// The privacy policy and terms (designs/src/legal.html, PP-159): public
// reading pages, signed in or out, with their own small header instead of the
// tab bar, and the text in a centred column.

export const LAST_UPDATED = "17 October 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-[640px] px-3 pt-3 flex items-center gap-1 md:pt-6">
        <BackButton />
        <p className="text-sm text-ink-muted">Recipe planner</p>
      </div>
      <main className="mx-auto max-w-[640px] px-5 pt-2 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-[15px] leading-6 md:px-8">
        <h1 className="font-display text-[28px] leading-9 font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">Last updated {LAST_UPDATED}</p>
        {children}
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mt-6 text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Points({ children }: { children: ReactNode }) {
  return <ul className="mt-2 space-y-2 list-disc pl-5">{children}</ul>;
}
