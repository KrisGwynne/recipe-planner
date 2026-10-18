"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { chooseHref } from "@/compare/compare";
import { recipeFileText } from "@/recipes/file";
import type { Recipe } from "@/types/recipe";
import { Sheet } from "@/components/ui/sheet";
import { AddToFreezerSheet, type FreezerRecipe } from "@/components/plans/add-to-freezer-sheet";
import { deleteRecipeAction } from "../actions";
import { FavouriteButton } from "./household";

const iconButton =
  "size-11 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary";

/**
 * The recipe page's top bar: back, the favourite heart and ⋯ (design A, G).
 * "Compare with…" comes first (PP-173) and "Delete recipe…" last, in red
 * (PP-165). `plans` are the meal plans it's in, with the meals ("Tue dinner").
 * "Add to freezer…" puts servings in the freezer by hand (PP-189, leftovers
 * design J).
 */
export function RecipeHeader({
  recipe,
  recipeId,
  plans,
  freezer,
  today,
}: {
  recipe: Recipe;
  recipeId: string;
  plans: { name: string; meals: string[] }[];
  freezer: FreezerRecipe;
  today: string;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [freezing, setFreezing] = useState(false);

  function back() {
    // Back to the filtered library if that's where we came from.
    if (document.referrer.startsWith(window.location.origin)) router.back();
    else router.push("/recipes");
  }

  function download() {
    const blob = new Blob([recipeFileText(recipe)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recipe.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenu(false);
  }

  return (
    <>
      <button type="button" onClick={back} aria-label="Back" className={iconButton}>
        <Icon name="arrow-left" className="size-6" />
      </button>
      <span className="flex-1" />
      <FavouriteButton />
      <button type="button" onClick={() => setMenu(true)} aria-label="More" className={iconButton}>
        <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {menu && (
        <Sheet title={recipe.name} onClose={() => setMenu(false)}>
          <ul className="divide-y divide-line">
            <li>
              {/* The slug is the recipe's id. */}
              <Link href={chooseHref([recipe.id])} className="w-full min-h-13 py-3 flex items-center gap-3 font-medium">
                <Icon name="chart" className="size-5 text-ink-muted" />
                Compare with…
              </Link>
            </li>
            <li>
              <button type="button" onClick={download} className="w-full min-h-13 py-3 flex items-center gap-3 text-left font-medium">
                <Icon name="download" className="size-5 text-ink-muted" />
                Download recipe file (.json)
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setFreezing(true);
                }}
                className="w-full min-h-13 py-3 flex items-center gap-3 text-left font-medium"
              >
                <Icon name="snow" className="size-5 text-ink-muted" />
                Add to freezer…
              </button>
            </li>
            <li>
              <Link href="/import" className="w-full min-h-13 py-3 flex items-center gap-3 font-medium">
                <Icon name="upload" className="size-5 text-ink-muted" />
                <span>
                  Replace with a new version…
                  <span className="block text-sm font-normal text-ink-muted">
                    Import the updated file; the review shows what changes.
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setDeleting(true);
                }}
                className="w-full min-h-13 py-3 flex items-center gap-3 text-left font-medium text-danger"
              >
                <Icon name="trash" className="size-5" />
                Delete recipe…
              </button>
            </li>
          </ul>
          <button type="button" onClick={() => setMenu(false)} className="mt-3 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
            Cancel
          </button>
        </Sheet>
      )}
      {freezing && <AddToFreezerSheet recipe={freezer} today={today} onClose={() => setFreezing(false)} />}
      {deleting && (
        <DeleteRecipeSheet name={recipe.name} recipeId={recipeId} plans={plans} onClose={() => setDeleting(false)} />
      )}
    </>
  );
}

/**
 * Import design H: names the plans and meals the recipe will disappear from;
 * a recipe in no plan gets the same sheet without the list.
 */
function DeleteRecipeSheet({
  name,
  recipeId,
  plans,
  onClose,
}: {
  name: string;
  recipeId: string;
  plans: { name: string; meals: string[] }[];
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setBusy(true);
    setFailed(false);
    // On success the action goes on to the library.
    if (!(await deleteRecipeAction(recipeId))) {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <Sheet title={`Delete ${name}?`} onClose={onClose}>
      {plans.length > 0 && (
        <>
          <p className="text-ink-muted">
            It&apos;s planned in {plans.length === 1 ? "1 meal plan" : `${plans.length} meal plans`} and will be removed from{" "}
            {plans.length === 1 ? "it" : "them"}:
          </p>
          <ul aria-label="Meal plans it's in" className="mt-3 rounded-control bg-surface-2 divide-y divide-line text-sm">
            {plans.map((plan, i) => (
              <li key={i} className="px-4 py-2.5 flex justify-between gap-3">
                <span className="font-medium min-w-0 truncate">{plan.name}</span>
                <span className="text-ink-muted text-right">{plan.meals.join(", ")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={plans.length > 0 ? "text-ink-muted mt-3 text-sm" : "text-ink-muted"}>
        Your notes, rating and cooking history for it are deleted too. To keep a copy, download the recipe file first.
      </p>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-danger">
          Couldn&apos;t delete the recipe. Try again.
        </p>
      )}
      <button type="button" disabled={busy} onClick={remove} className={buttonClasses("danger", "mt-5 w-full")}>
        Delete recipe
      </button>
      <button type="button" onClick={onClose} className="mt-2 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
        Cancel
      </button>
    </Sheet>
  );
}
