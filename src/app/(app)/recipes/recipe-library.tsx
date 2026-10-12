"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { RecipeCard, RecipeRow, type RecipeSummary } from "@/components/ui/recipe-card";
import { cx } from "@/lib/cx";
import { viewCookie, type LibraryView } from "./view";

// The household's recipes as cards or a list (library design A and B). Sort,
// search and filters join the row above the results in PP-167.
export function RecipeLibrary({ recipes, initialView }: { recipes: RecipeSummary[]; initialView: LibraryView }) {
  const [view, setView] = useState(initialView);

  function choose(next: LibraryView) {
    setView(next);
    document.cookie = viewCookie(next);
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <div role="group" aria-label="View" className="flex rounded-full bg-surface-2 p-0.5">
          <ViewButton label="Cards" icon="grid" pressed={view === "cards"} onClick={() => choose("cards")} />
          <ViewButton label="List" icon="list" pressed={view === "list"} onClick={() => choose("list")} />
        </div>
      </div>
      {view === "cards" ? (
        <ul className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.href}>
              <RecipeCard recipe={recipe} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-3 max-w-3xl rounded-card bg-surface border border-line divide-y divide-line overflow-hidden">
          {recipes.map((recipe) => (
            <li key={recipe.href}>
              <RecipeRow recipe={recipe} />
            </li>
          ))}
        </ul>
      )}
    </>
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
