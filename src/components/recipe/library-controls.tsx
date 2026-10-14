"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cx } from "@/lib/cx";
import {
  SORTS,
  activeFilters,
  countMatching,
  facets,
  noFilters,
  parseState,
  removalSuggestions,
  toSearch,
  type Filters,
  type LibraryRecipe,
  type LibraryState,
} from "@/recipes/library-filter";
import { FilterSections } from "./filter-sections";

// Search, filters and sort as the library has them (designs/src/library.html
// C to H), shared by the library and the meal plan's recipe picker (meal
// plans design E).

/**
 * The library state, kept in the URL: filters and sort add history entries,
 * typing replaces the entry. The search box keeps its own text so typing
 * never lags, and follows the URL on back and forward. `keep` names other
 * query parameters to carry over (the picker's day and meal). With
 * `replaceOnly`, nothing adds a history entry, so back leaves the page.
 */
export function useLibraryState({ keep = [], replaceOnly = false }: { keep?: readonly string[]; replaceOnly?: boolean } = {}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = parseState(params);

  const [q, setQ] = useState(fromUrl.q);
  const [urlQ, setUrlQ] = useState(fromUrl.q);
  if (fromUrl.q !== urlQ) {
    setUrlQ(fromUrl.q);
    setQ(fromUrl.q);
  }
  const state: LibraryState = { ...fromUrl, q };

  function go(next: LibraryState, replace = false) {
    const query = new URLSearchParams();
    for (const name of keep) for (const value of params.getAll(name)) query.append(name, value);
    for (const [name, value] of new URLSearchParams(toSearch(next))) query.append(name, value);
    const text = query.toString();
    const url = `${pathname}${text ? `?${text}` : ""}`;
    if (replace || replaceOnly) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }
  const setFilters = (filters: Filters) => go({ ...state, filters });
  function search(text: string) {
    setQ(text);
    setUrlQ(text);
    go({ ...state, q: text }, true);
  }

  return { state, go, setFilters, search };
}

/**
 * The search box and the Filters button (library design A and C). While
 * typing, Cancel takes the button's place. With `panelFromLg`, the button is
 * hidden on wide screens, where the filters sit in a panel.
 */
export function SearchBar({
  q,
  onSearch,
  filterCount,
  onFilters,
  panelFromLg = false,
}: {
  q: string;
  onSearch: (text: string) => void;
  filterCount: number;
  onFilters: () => void;
  panelFromLg?: boolean;
}) {
  const [searching, setSearching] = useState(false);
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Icon name="search" className="size-5 absolute left-4 top-3.5 text-ink-subtle pointer-events-none" />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
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
            onClick={() => onSearch("")}
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
            onSearch("");
            (document.activeElement as HTMLElement | null)?.blur();
          }}
          className={cx("h-12 px-2 font-semibold text-primary", panelFromLg && "lg:hidden")}
        >
          Cancel
        </button>
      ) : (
        <button
          type="button"
          onClick={onFilters}
          className={cx(
            "h-12 px-4 rounded-full font-semibold inline-flex items-center gap-2",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            filterCount > 0 ? "bg-ink text-bg" : "border border-line bg-surface",
            panelFromLg && "lg:hidden",
          )}
        >
          <Icon name="sliders" className="size-5" />
          {filterCount > 0 ? `Filters · ${filterCount}` : "Filters"}
        </button>
      )}
    </div>
  );
}

/** The sort options (library design F). */
export function SortSheet({
  state,
  onSort,
  onClose,
}: {
  state: LibraryState;
  onSort: (next: LibraryState) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Sort by" onClose={onClose}>
      <ul className="divide-y divide-line">
        {SORTS.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              aria-pressed={state.sort === s.key}
              onClick={() => {
                onClose();
                onSort({ ...state, sort: s.key });
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
  );
}

/** The phone's filter sheet: changes apply on "Show N recipes"; closing throws them away. */
export function FilterSheet({
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

/** Design H: the filters worth removing, with how many recipes each brings back. */
export function NothingMatches({
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
