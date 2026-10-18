"use client";

import { useState, useTransition } from "react";
import { addToFreezerAction } from "@/app/(app)/plans/freezer/actions";
import { Icon } from "@/components/icon";
import { categoryDotClasses, type Category } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { MAX_FROZEN } from "@/plans/freezer";
import { MIN_PORTIONS, formatPortions, servings } from "@/plans/plan";

export type FreezerRecipe = { id: string; name: string; serves: number; category: Category };

const field = "mt-1.5 w-full min-h-12 px-4 py-2 rounded-control bg-surface-2 border border-line text-[17px]";

/**
 * Add to freezer by hand (leftovers design J): for batch cooking outside a
 * plan, or what was in the freezer already. From the freezer page the recipe
 * is chosen from a searchable list; from a recipe page's ⋯ it's filled in.
 * Servings start at what the recipe makes; frozen on is today unless changed,
 * and can't be in the future.
 */
export function AddToFreezerSheet({
  recipes,
  recipe: fixed,
  today,
  onClose,
}: {
  recipes?: FreezerRecipe[];
  recipe?: FreezerRecipe;
  today: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [recipe, setRecipe] = useState<FreezerRecipe | undefined>(fixed);
  const [choosing, setChoosing] = useState(!fixed);
  const [q, setQ] = useState("");
  const [amount, setAmount] = useState(fixed ? Math.min(fixed.serves, MAX_FROZEN) : 1);
  const [frozenOn, setFrozenOn] = useState(today);
  const [saving, startSaving] = useTransition();
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = (recipes ?? []).filter((r) => words.every((w) => r.name.toLowerCase().includes(w)));
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(frozenOn) && frozenOn <= today;

  function choose(next: FreezerRecipe) {
    setRecipe(next);
    setAmount(Math.min(next.serves, MAX_FROZEN));
    setChoosing(false);
  }

  function add() {
    if (!recipe || !validDate) return;
    startSaving(async () => {
      const id = await addToFreezerAction({ recipeId: recipe.id, servings: amount, frozenOn });
      if (!id) {
        toast("Couldn't add that to the freezer. Try again.");
        return;
      }
      onClose();
      toast(`${servings(amount)} added to the freezer`);
    });
  }

  if (choosing) {
    return (
      <Sheet title="Add to freezer" onClose={recipe ? () => setChoosing(false) : onClose} full>
        <label className="block">
          <span className="sr-only">Search recipes</span>
          <span className="relative block">
            <Icon name="search" className="size-5 absolute left-4 top-3.5 text-ink-subtle" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search recipes"
              className="w-full h-12 pl-12 pr-4 rounded-full bg-surface border border-line placeholder:text-ink-subtle"
            />
          </span>
        </label>
        {found.length === 0 ? (
          <p className="mt-6 text-center text-ink-muted">{recipes?.length ? "No recipes match." : "No recipes yet."}</p>
        ) : (
          <ul aria-label="Recipes" className="mt-3 rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
            {found.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => choose(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-14 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  <CategoryBar category={r.category} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{r.name}</span>
                    <span className="block text-sm text-ink-subtle">Serves {r.serves}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet title="Add to freezer" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <span className="text-sm font-medium">Recipe</span>
          {fixed ? (
            <p className={cx(field, "flex items-center gap-3")}>
              <CategoryBar category={fixed.category} />
              <span className="flex-1">{fixed.name}</span>
            </p>
          ) : (
            <button type="button" onClick={() => setChoosing(true)} className={cx(field, "flex items-center gap-3 text-left")}>
              {recipe && <CategoryBar category={recipe.category} />}
              <span className="flex-1">{recipe?.name ?? "Choose a recipe"}</span>
              <Icon name="chevron-right" className="size-5 text-ink-muted" />
            </button>
          )}
        </div>
        <Stepper
          label="Servings"
          hint={recipe ? `The recipe makes ${recipe.serves}` : undefined}
          value={amount}
          min={MIN_PORTIONS}
          max={MAX_FROZEN}
          step={0.5}
          format={formatPortions}
          onChange={setAmount}
        />
        <label className="block">
          <span className="text-sm font-medium">Frozen on</span>
          <input type="date" value={frozenOn} max={today} onChange={(e) => setFrozenOn(e.target.value)} className={cx(field, "h-12")} />
          {!validDate && <span className="mt-1 block text-sm text-danger">Choose today or an earlier day</span>}
        </label>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={!recipe || !validDate || saving}
        className={buttonClasses("primary", "mt-6 w-full")}
      >
        Add {servings(amount)}
      </button>
    </Sheet>
  );
}

function CategoryBar({ category }: { category: Category }) {
  return (
    <span className="w-1 self-stretch min-h-8 flex flex-col rounded-full overflow-hidden" aria-hidden="true">
      {categoryDotClasses(category).map((dot) => (
        <span key={dot} className={cx("flex-1", dot)} />
      ))}
    </span>
  );
}
