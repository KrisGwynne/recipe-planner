"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { FilterSheet, NothingMatches, SearchBar, SortSheet, useLibraryState } from "@/components/recipe/library-controls";
import { categoryDotClasses, categoryLabels } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ActiveFilterChip } from "@/components/ui/chip";
import { MAX_RECIPES, MIN_RECIPES, compareHref } from "@/compare/compare";
import { cx } from "@/lib/cx";
import { approx, formatMinutes } from "@/lib/format";
import { SORTS, activeFilters, applyState, type LibraryRecipe } from "@/recipes/library-filter";
import { toRecipeSummary } from "@/recipes/summary";

/**
 * The library as a full-screen picker (compare design B), covering the tab
 * bar on phones. Tapping a row ticks or unticks it, up to four; then the rest
 * can't be ticked and the note says why (design I). Search, filters and sort
 * work as in the library without adding history entries. Ticked recipes stay
 * where they are in the list, so nothing jumps.
 */
export function ComparePicker({ recipes, initial }: { recipes: LibraryRecipe[]; initial: string[] }) {
  const router = useRouter();
  const { state, go, setFilters, search } = useLibraryState({ keep: ["r"], replaceOnly: true });
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);
  const [chosen, setChosen] = useState<string[]>(initial);

  const results = applyState(recipes, state);
  const chips = activeFilters(state.filters);
  const filtering = chips.length > 0 || state.q.trim().length > 0;
  const full = chosen.length >= MAX_RECIPES;

  function close() {
    if (window.history.length > 1) router.back();
    else router.replace(compareHref(initial));
  }

  function toggle(slug: string) {
    setChosen((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : current.length < MAX_RECIPES ? [...current, slug] : current,
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg md:static md:z-auto md:overflow-visible">
      <div className="mx-auto max-w-3xl">
        <div className="px-3 pt-3 flex items-center gap-1 md:pt-6">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="size-11 shrink-0 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name="x" className="size-6" />
          </button>
          <h1 className="flex-1 font-display text-[22px] leading-7 font-semibold">Choose recipes</h1>
        </div>

        {recipes.length < MIN_RECIPES ? (
          <div className="mx-auto max-w-sm px-8 pt-16 text-center">
            <p className="font-display text-xl font-semibold">Import at least two recipes to compare them</p>
            <p className="text-ink-muted mt-1">{recipes.length === 0 ? "You don't have any yet." : "You have 1 so far."}</p>
            <Link href="/import" className={buttonClasses("primary", "mt-6 w-full")}>
              <Icon name="upload" className="size-5" />
              Import recipes
            </Link>
          </div>
        ) : (
          <div className="px-5 pt-3 pb-4">
            <SearchBar q={state.q} onSearch={search} filterCount={chips.length} onFilters={() => setSheet("filters")} />
            {chips.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
                {chips.map((chip) => (
                  <ActiveFilterChip key={chip.key} label={chip.label} onRemove={() => setFilters(chip.remove(state.filters))} />
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSheet("sort")}
                aria-label={`Sort: ${SORTS.find((s) => s.key === state.sort)?.label}`}
                className="h-11 -ml-1 px-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink rounded-control focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Icon name="sort" className="size-4" />
                {SORTS.find((s) => s.key === state.sort)?.label}
                <Icon name="chevron-down" className="size-4" />
              </button>
              <span className="text-sm text-ink-muted tabular-nums">
                {filtering ? `${results.length} of ${recipes.length}` : `${recipes.length} recipes`}
              </span>
            </div>

            {results.length === 0 ? (
              <NothingMatches recipes={recipes} state={state} onFilters={setFilters} onClearSearch={() => search("")} />
            ) : (
              <ul aria-label="Recipes" className="mt-1 rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
                {results.map((recipe) => {
                  const ticked = chosen.includes(recipe.slug);
                  return (
                    <li key={recipe.slug}>
                      <PickerRow recipe={recipe} ticked={ticked} disabled={full && !ticked} onToggle={() => toggle(recipe.slug)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {recipes.length >= MIN_RECIPES && (
        <div className="sticky bottom-0 border-t border-line bg-surface md:static md:border-t-0 md:bg-transparent">
          <div className="mx-auto max-w-3xl px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <p role="status" className="text-sm text-ink-muted tabular-nums">
              {full ? "4 is the most. Untick one to choose another." : `${chosen.length} chosen · up to ${MAX_RECIPES}`}
            </p>
            <button
              type="button"
              disabled={chosen.length < MIN_RECIPES}
              onClick={() => router.replace(compareHref(chosen))}
              className={buttonClasses("primary", "mt-2 w-full")}
            >
              {chosen.length < MIN_RECIPES ? "Choose at least 2" : `Compare ${chosen.length} recipes`}
            </button>
          </div>
        </div>
      )}

      {sheet === "filters" && (
        <FilterSheet recipes={recipes} state={state} onApply={setFilters} onClose={() => setSheet(null)} />
      )}
      {sheet === "sort" && <SortSheet state={state} onSort={(next) => go(next)} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** A list row with a tick (design B). */
function PickerRow({
  recipe,
  ticked,
  disabled,
  onToggle,
}: {
  recipe: LibraryRecipe;
  ticked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const summary = toRecipeSummary(recipe);
  const estimated = summary.nutritionSource === "estimated";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={ticked}
      className={cx(
        "w-full flex items-center gap-3 px-4 py-3 min-h-16 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        ticked ? "bg-primary-soft/40" : "hover:bg-surface-2",
        disabled && "opacity-50",
      )}
    >
      <span className="w-1 self-stretch flex flex-col rounded-full overflow-hidden" aria-hidden="true">
        {categoryDotClasses(summary.category).map((dot) => (
          <span key={dot} className={cx("flex-1", dot)} />
        ))}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{recipe.name}</span>
        <span className="sr-only">{categoryLabels[summary.category]}</span>
        <span className="block text-sm text-ink-muted tabular-nums">
          {formatMinutes(summary.totalMins)} · {approx(`${summary.kcal} kcal`, estimated)} ·{" "}
          {approx(`${summary.proteinG}g protein`, estimated)}
        </span>
      </span>
      {ticked ? (
        <span className="size-7 shrink-0 rounded-full bg-primary text-on-primary grid place-items-center" aria-hidden="true">
          <Icon name="check" className="size-4" strokeWidth={3} />
        </span>
      ) : (
        <span className="size-7 shrink-0 rounded-full border-2 border-line" aria-hidden="true" />
      )}
    </button>
  );
}
