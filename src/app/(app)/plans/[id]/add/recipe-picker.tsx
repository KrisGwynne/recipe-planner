"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { FilterSheet, NothingMatches, SearchBar, SortSheet, useLibraryState } from "@/components/recipe/library-controls";
import { categoryDotClasses, categoryLabels, categoryOf } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ActiveFilterChip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { approx, formatMinutes } from "@/lib/format";
import type { AvailableLeftovers } from "@/data";
import { daysOld, mealLabel } from "@/plans/leftovers";
import { formatDay, formatPortions, mealName, planDay, slotLabels, type Slot } from "@/plans/plan";
import { browsingCategory } from "@/recipes/derive";
import { SORTS, activeFilters, applyState, type LibraryRecipe } from "@/recipes/library-filter";
import { toRecipeSummary } from "@/recipes/summary";
import { addEntryAction, addLeftoversAction, removeEntryAction } from "../../actions";

type PickerRecipe = LibraryRecipe & { id: string; serves: number };

/**
 * The library as a full-screen picker (meal plans design E), covering the tab
 * bar on phones. It starts filtered to the meal being added, as a chip that
 * can be removed; search, filters and sort work as in the library, without
 * adding history entries, so back returns to the plan. Tapping a recipe adds
 * it with 1 portion each and goes back, with an Undo toast.
 *
 * Leftovers not yet planned come first (leftovers design D), oldest first,
 * whatever the meal filter; while searching, only the ones that match.
 */
export function RecipePicker({
  plan,
  dayIndex,
  slot,
  recipes,
  inPlan,
  leftovers,
}: {
  plan: { id: string; name: string; startDate: string; people: number };
  dayIndex: number;
  slot: Slot;
  recipes: PickerRecipe[];
  inPlan: Record<string, string[]>;
  leftovers: AvailableLeftovers[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { state, go, setFilters, search } = useLibraryState({ keep: ["day", "slot"], replaceOnly: true });
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);
  const [adding, startAdding] = useTransition();

  const results = applyState(recipes, state) as PickerRecipe[];
  const chips = activeFilters(state.filters);
  const filtering = chips.length > 0 || state.q.trim().length > 0;
  const where = mealName(plan, dayIndex, slot);
  const mealFiltered = state.filters.meal.includes(slot);

  function backToPlan() {
    if (window.history.length > 1) router.back();
    else router.replace(`/plans/${plan.id}#day-${dayIndex}`);
  }

  const words = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const waiting = leftovers.filter((l) => words.every((w) => l.recipe.name.toLowerCase().includes(w)));

  function addLeftovers(from: AvailableLeftovers) {
    startAdding(async () => {
      const id = await addLeftoversAction(plan.id, { dayIndex, slot, cookId: from.cookId });
      if (!id) {
        toast("Couldn't add the leftovers. Try again.");
        return;
      }
      toast(`Added to ${where}`, { undo: () => void removeEntryAction(plan.id, id) });
      backToPlan();
    });
  }

  function add(recipe: PickerRecipe) {
    startAdding(async () => {
      const id = await addEntryAction(plan.id, { dayIndex, slot, recipeId: recipe.id });
      if (!id) {
        toast("Couldn't add that recipe. Try again.");
        return;
      }
      toast(`Added to ${where}`, { undo: () => void removeEntryAction(plan.id, id) });
      backToPlan();
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg md:static md:z-auto md:overflow-visible">
      <div className="mx-auto max-w-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="px-3 pt-3 flex items-center gap-1 md:pt-6">
          <button
            type="button"
            onClick={backToPlan}
            aria-label="Close"
            className="size-11 shrink-0 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon name="x" className="size-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-[22px] leading-7 font-semibold">Add {slot}</h1>
            <p className="text-sm text-ink-muted truncate">
              {formatDay(planDay(plan, dayIndex))} · {plan.name}
            </p>
          </div>
        </div>

        {recipes.length === 0 ? (
          <div className="mx-auto max-w-sm px-8 pt-16 text-center">
            <p className="font-display text-xl font-semibold">No recipes yet</p>
            <p className="text-ink-muted mt-1">Import some recipes, then add them to the plan.</p>
            <Link href="/import" className={buttonClasses("primary", "mt-6 w-full")}>
              <Icon name="upload" className="size-5" />
              Import recipes
            </Link>
          </div>
        ) : (
          <div className="px-5 pt-3">
            <SearchBar q={state.q} onSearch={search} filterCount={chips.length} onFilters={() => setSheet("filters")} />
            {waiting.length > 0 && (
              <section aria-labelledby="leftovers-heading" className="mt-4">
                <h2 id="leftovers-heading" className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Leftovers
                </h2>
                <ul
                  aria-busy={adding}
                  className="mt-2 rounded-card bg-surface border border-line divide-y divide-line overflow-hidden"
                >
                  {waiting.map((from) => (
                    <li key={from.cookId}>
                      <LeftoversRow
                        from={from}
                        plan={plan}
                        mealDate={planDay(plan, dayIndex)}
                        disabled={adding}
                        onAdd={() => addLeftovers(from)}
                      />
                    </li>
                  ))}
                </ul>
                <h2 className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">Recipes</h2>
              </section>
            )}
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
              <ul
                aria-label="Recipes"
                aria-busy={adding}
                className="mt-1 rounded-card bg-surface border border-line divide-y divide-line overflow-hidden"
              >
                {results.map((recipe) => (
                  <li key={recipe.id}>
                    <PickerRow recipe={recipe} inPlan={inPlan[recipe.id]} disabled={adding} onAdd={() => add(recipe)} />
                  </li>
                ))}
              </ul>
            )}

            {mealFiltered && results.length > 0 && (
              <p className="mt-4 text-center text-sm text-ink-muted">
                Not here?{" "}
                <button
                  type="button"
                  onClick={() => setFilters({ ...state.filters, meal: state.filters.meal.filter((m) => m !== slot) })}
                  className="font-semibold text-primary"
                >
                  Remove the {slotLabels[slot]} filter
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      {sheet === "filters" && (
        <FilterSheet recipes={recipes} state={state} onApply={setFilters} onClose={() => setSheet(null)} />
      )}
      {sheet === "sort" && <SortSheet state={state} onSort={(next) => go(next)} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Leftovers waiting to be eaten (leftovers design D): "4 left · from Tue dinner", in amber when 2 or more days old by the meal. */
function LeftoversRow({
  from,
  plan,
  mealDate,
  disabled,
  onAdd,
}: {
  from: AvailableLeftovers;
  plan: { id: string; startDate: string };
  mealDate: string;
  disabled: boolean;
  onAdd: () => void;
}) {
  const category = categoryOf(browsingCategory(from.recipe.proteinType, from.recipe.dietary));
  const old = daysOld(from.date, mealDate);
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-16 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      <span className="w-1 self-stretch flex flex-col rounded-full overflow-hidden" aria-hidden="true">
        {categoryDotClasses(category).map((dot) => (
          <span key={dot} className={cx("flex-1", dot)} />
        ))}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{from.recipe.name}</span>
        <span className="sr-only">{categoryLabels[category]}</span>
        <span className="block text-sm tabular-nums">
          <span className="text-ink-muted">
            {formatPortions(from.left)} left · from {mealLabel(from, plan.id)}
          </span>
          {old !== null && (
            <span className="text-warning font-medium">
              {" "}
              · {old} days old by {formatDay(mealDate).split(" ")[0]}
            </span>
          )}
        </span>
      </span>
      <Icon name="plus" className="size-6 text-primary shrink-0" />
    </button>
  );
}

/** A denser row than the library's (design E): adds "Serves N", which decides leftovers, and where it's already planned. */
function PickerRow({
  recipe,
  inPlan,
  disabled,
  onAdd,
}: {
  recipe: PickerRecipe;
  inPlan?: string[];
  disabled: boolean;
  onAdd: () => void;
}) {
  const summary = toRecipeSummary(recipe);
  const estimated = summary.nutritionSource === "estimated";
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-16 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
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
        <span className="block text-sm text-ink-subtle">
          Serves {recipe.serves}
          {inPlan && inPlan.length > 0 && ` · In this plan: ${inPlan.join(", ")}`}
        </span>
      </span>
      <Icon name="plus" className="size-6 text-primary shrink-0" />
    </button>
  );
}
