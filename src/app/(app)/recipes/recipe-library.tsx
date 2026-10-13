"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { ActiveFilterChip } from "@/components/ui/chip";
import { Page } from "@/components/page";
import { RecipeCard, RecipeRow } from "@/components/ui/recipe-card";
import { FilterSections } from "@/components/recipe/filter-sections";
import {
  FilterSheet,
  NothingMatches,
  SearchBar,
  SortSheet,
  useLibraryState,
} from "@/components/recipe/library-controls";
import { cx } from "@/lib/cx";
import {
  SORTS,
  activeFilters,
  applyState,
  facets,
  matchedIngredient,
  noFilters,
  searchWords,
  type LibraryRecipe,
  type SortKey,
} from "@/recipes/library-filter";
import { toRecipeSummary } from "@/recipes/summary";
import { viewCookie, type LibraryView } from "./view";

const emphasis: Partial<Record<SortKey, "time" | "kcal" | "protein">> = {
  quickest: "time",
  calories: "kcal",
  protein: "protein",
};

/**
 * The library (designs/src/library.html A to H): search, filters, sort and
 * the card or list view. Everything is worked out here from the household's
 * recipes, so results and counts change as you type or tick. The state is in
 * the URL: filters and sort add history entries, typing replaces the entry.
 */
export function RecipeLibrary({ recipes, initialView }: { recipes: LibraryRecipe[]; initialView: LibraryView }) {
  const { state, go, setFilters, search } = useLibraryState();
  const [view, setView] = useState(initialView);
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);

  const { q } = state;
  const words = searchWords(q);
  const results = applyState(recipes, state);
  const chips = activeFilters(state.filters);
  const filtering = chips.length > 0 || words.length > 0;

  function chooseView(next: LibraryView) {
    setView(next);
    document.cookie = viewCookie(next);
  }

  const count = filtering
    ? `${results.length} of ${recipes.length}`
    : recipes.length === 1
      ? "1 recipe"
      : `${recipes.length} recipes`;

  return (
    <Page title="Recipes" aside={<span className="tabular-nums">{count}</span>}>
      <div className="lg:flex lg:gap-8">
        {/* Wider screens: the filters sit in a panel and apply straight away. */}
        <aside aria-label="Filters" className="hidden lg:block w-72 shrink-0">
          <h2 className="font-display text-xl font-semibold mb-4">Filters</h2>
          <FilterSections filters={state.filters} facets={facets(recipes, state)} onChange={setFilters} />
        </aside>

        <div className="flex-1 min-w-0">
          <SearchBar
            q={q}
            onSearch={search}
            filterCount={chips.length}
            onFilters={() => setSheet("filters")}
            panelFromLg
          />

          {chips.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
              {chips.map((chip) => (
                <ActiveFilterChip key={chip.key} label={chip.label} onRemove={() => setFilters(chip.remove(state.filters))} />
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
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
            <div role="group" aria-label="View" className="flex rounded-full bg-surface-2 p-0.5">
              <ViewButton label="Cards" icon="grid" pressed={view === "cards"} onClick={() => chooseView("cards")} />
              <ViewButton label="List" icon="list" pressed={view === "list"} onClick={() => chooseView("list")} />
            </div>
          </div>

          {words.length > 0 && results.length > 0 && (
            <p className="mt-2 text-sm text-ink-muted" role="status">
              <b className="text-ink">{results.length === 1 ? "1 recipe" : `${results.length} recipes`}</b> match &ldquo;
              {q.trim()}&rdquo;
            </p>
          )}

          {results.length === 0 ? (
            <NothingMatches
              recipes={recipes}
              state={state}
              onFilters={setFilters}
              onClearSearch={() => search("")}
            />
          ) : (
            <Results recipes={results} words={words} view={view} sort={state.sort} />
          )}

          {filtering && results.length > 0 && (
            <p className="mt-6 text-center text-sm text-ink-muted">
              That&apos;s everything that matches.
              <br />
              <button
                type="button"
                onClick={() => go({ ...state, filters: noFilters(), q: "" })}
                className="mt-1 font-semibold text-primary"
              >
                {chips.length > 0 ? "Clear filters" : "Clear search"}
              </button>
            </p>
          )}
        </div>
      </div>

      {sheet === "filters" && (
        <FilterSheet recipes={recipes} state={state} onApply={setFilters} onClose={() => setSheet(null)} />
      )}
      {sheet === "sort" && <SortSheet state={state} onSort={(next) => go(next)} onClose={() => setSheet(null)} />}
    </Page>
  );
}

function Results({
  recipes,
  words,
  view,
  sort,
}: {
  recipes: LibraryRecipe[];
  words: string[];
  view: LibraryView;
  sort: SortKey;
}) {
  const summaries = recipes.map((r) => ({
    ...toRecipeSummary(r),
    highlight: words,
    matchedIngredient: matchedIngredient(r, words),
  }));
  return view === "cards" ? (
    <ul className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
      {summaries.map((recipe) => (
        <li key={recipe.href}>
          <RecipeCard recipe={recipe} />
        </li>
      ))}
    </ul>
  ) : (
    <ul className="mt-3 max-w-3xl rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
      {summaries.map((recipe) => (
        <li key={recipe.href}>
          <RecipeRow recipe={recipe} emphasis={emphasis[sort]} />
        </li>
      ))}
    </ul>
  );
}

/** 36px to look at, as in the design, with a 44px tap area. */
function ViewButton({
  label,
  icon,
  pressed,
  onClick,
}: {
  label: string;
  icon: IconName;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "relative size-9 rounded-full grid place-items-center after:absolute after:-inset-1",
        "focus-visible:outline-2 focus-visible:outline-primary",
        pressed ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
      )}
    >
      <Icon name={icon} className="size-[18px]" />
    </button>
  );
}

