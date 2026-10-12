"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { ActiveFilterChip } from "@/components/ui/chip";
import { Page } from "@/components/page";
import { RecipeCard, RecipeRow } from "@/components/ui/recipe-card";
import { cx } from "@/lib/cx";
import {
  SORTS,
  activeFilters,
  applyState,
  countMatching,
  facets,
  matchedIngredient,
  noFilters,
  parseState,
  removalSuggestions,
  searchWords,
  toSearch,
  type Filters,
  type LibraryRecipe,
  type LibraryState,
  type SortKey,
} from "@/recipes/library-filter";
import { toRecipeSummary } from "@/recipes/summary";
import { FilterSections } from "./filter-sections";
import { Sheet } from "./sheet";
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
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = parseState(params);

  // The search box keeps its own text so typing never lags; it follows the URL on back and forward.
  const [q, setQ] = useState(fromUrl.q);
  const [urlQ, setUrlQ] = useState(fromUrl.q);
  if (fromUrl.q !== urlQ) {
    setUrlQ(fromUrl.q);
    setQ(fromUrl.q);
  }

  const state: LibraryState = { ...fromUrl, q };
  const [view, setView] = useState(initialView);
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);
  const [searching, setSearching] = useState(false);

  const words = searchWords(q);
  const results = applyState(recipes, state);
  const chips = activeFilters(state.filters);
  const filtering = chips.length > 0 || words.length > 0;

  function go(next: LibraryState, replace = false) {
    const url = `${pathname}${toSearch(next)}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }
  const setFilters = (filters: Filters) => go({ ...state, filters });
  function search(text: string) {
    setQ(text);
    setUrlQ(text);
    go({ ...state, q: text }, true);
  }
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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Icon name="search" className="size-5 absolute left-4 top-3.5 text-ink-subtle pointer-events-none" />
              <input
                type="search"
                value={q}
                onChange={(e) => search(e.target.value)}
                onFocus={() => setSearching(true)}
                onBlur={() => setSearching(false)}
                placeholder="Search recipes"
                aria-label="Search recipes"
                enterKeyHint="search"
                className={cx(
                  "w-full h-12 pl-12 rounded-full bg-surface border placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden",
                  "focus:outline-none focus:border-2 focus:border-primary",
                  q ? "pr-11" : "pr-4",
                  "border-line",
                )}
              />
              {q && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => search("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-2 size-8 rounded-full bg-surface-2 grid place-items-center focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Icon name="x" className="size-4" />
                </button>
              )}
            </div>
            {searching ? (
              <button
                type="button"
                // Before the input loses focus, so the tap lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  search("");
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
                className="h-12 px-2 font-semibold text-primary lg:hidden"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSheet("filters")}
                className={cx(
                  "h-12 px-4 rounded-full font-semibold inline-flex items-center gap-2 lg:hidden",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  chips.length > 0 ? "bg-ink text-bg" : "border border-line bg-surface",
                )}
              >
                <Icon name="sliders" className="size-5" />
                {chips.length > 0 ? `Filters · ${chips.length}` : "Filters"}
              </button>
            )}
          </div>

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
      {sheet === "sort" && (
        <Sheet title="Sort by" onClose={() => setSheet(null)}>
          <ul className="divide-y divide-line">
            {SORTS.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={state.sort === s.key}
                  onClick={() => {
                    setSheet(null);
                    go({ ...state, sort: s.key });
                  }}
                  className={cx(
                    "w-full min-h-12 py-3 flex items-center justify-between text-left",
                    state.sort === s.key ? "font-semibold text-primary" : "font-medium",
                  )}
                >
                  {s.label}
                  {state.sort === s.key && <Icon name="check" className="size-5" strokeWidth={2.5} />}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
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

/** Design H: the filters worth removing, with how many recipes each brings back. */
function NothingMatches({
  recipes,
  state,
  onFilters,
  onClearSearch,
}: {
  recipes: LibraryRecipe[];
  state: LibraryState;
  onFilters: (filters: Filters) => void;
  onClearSearch: () => void;
}) {
  const suggestions = removalSuggestions(recipes, state);
  const hasFilters = activeFilters(state.filters).length > 0;
  const searchOnly = !hasFilters;
  return (
    <div className="mx-auto max-w-sm px-3 pt-12 text-center">
      <p className="font-display text-xl font-semibold">No recipes match</p>
      {searchOnly ? (
        <>
          <p className="text-ink-muted mt-1">Nothing has &ldquo;{state.q.trim()}&rdquo; in its name, ingredients or source.</p>
          <button type="button" onClick={onClearSearch} className="mt-4 font-semibold text-primary">
            Clear search
          </button>
        </>
      ) : (
        <>
          {suggestions.length > 0 && <p className="text-ink-muted mt-1">Try removing a filter:</p>}
          <div className="mt-4 space-y-2">
            {suggestions.map(({ filter, count }) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => onFilters(filter.remove(state.filters))}
                className={buttonClasses("secondary", "w-full justify-between px-4 font-medium")}
              >
                Remove &ldquo;{filter.label}&rdquo;
                <span className="text-sm text-ink-muted font-normal">{count === 1 ? "1 recipe" : `${count} recipes`}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onFilters(noFilters())} className="mt-4 font-semibold text-primary">
            Clear all filters
          </button>
        </>
      )}
    </div>
  );
}

/** The phone's filter sheet: changes apply on "Show N recipes"; closing throws them away. */
function FilterSheet({
  recipes,
  state,
  onApply,
  onClose,
}: {
  recipes: LibraryRecipe[];
  state: LibraryState;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(state.filters);
  const n = countMatching(recipes, draft, state.q);
  return (
    <Sheet
      title="Filters"
      full
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={() => setDraft(noFilters())} className={buttonClasses("secondary", "px-5")}>
            Clear all
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className={buttonClasses("primary", "flex-1")}
          >
            {n === 1 ? "Show 1 recipe" : `Show ${n} recipes`}
          </button>
        </div>
      }
    >
      <FilterSections filters={draft} facets={facets(recipes, { ...state, filters: draft })} onChange={setDraft} />
    </Sheet>
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

