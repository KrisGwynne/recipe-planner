import { Page } from "@/components/page";

// While the library loads: three card outlines (Kris, 2026-10-12, PP-166).
export default function RecipesLoading() {
  return (
    <Page title="Recipes">
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading recipes</span>
        <div className="h-9" />
        <ul className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rounded-card bg-surface border border-line p-4 motion-safe:animate-pulse">
              <div className="h-6 w-3/4 rounded bg-surface-2" />
              <div className="mt-3 h-4 w-1/2 rounded bg-surface-2" />
              <div className="mt-4 flex gap-2">
                <div className="h-7 w-16 rounded-full bg-surface-2" />
                <div className="h-7 w-20 rounded-full bg-surface-2" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}
