import Link from "next/link";
import { cx } from "@/lib/cx";
import { approx, formatMinutes } from "@/lib/format";
import { Icon } from "@/components/icon";
import { Badge, CategoryBadge, NutritionBadge, categoryDotClass, categoryLabels, type Category } from "./badge";

/** What a card or list row shows: name first, then the numbers people choose by, then badges. */
export type RecipeSummary = {
  name: string;
  href: string;
  totalMins: number;
  kcal: number;
  proteinG: number;
  nutritionSource: "printed" | "estimated";
  category: Category;
  /** e.g. "Tuna", shown as "Fish · Tuna". */
  categoryDetail?: string;
  /** Carb labels, e.g. ["Pasta"]. */
  carbs: string[];
};

/**
 * Typographic recipe card (no photos). The whole card is a link; the
 * favourite button sits above it. Without `onToggleFavourite` there's no button.
 */
export function RecipeCard({
  recipe,
  favourite = false,
  onToggleFavourite,
}: {
  recipe: RecipeSummary;
  favourite?: boolean;
  onToggleFavourite?: () => void;
}) {
  const estimated = recipe.nutritionSource === "estimated";
  return (
    <article className="relative rounded-card bg-surface border border-line p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-primary">
      <div className="flex items-start gap-3">
        <h3 className="flex-1 font-display text-xl font-semibold leading-snug">
          <Link href={recipe.href} className="outline-none after:absolute after:inset-0 after:rounded-card">
            {recipe.name}
          </Link>
        </h3>
        {onToggleFavourite && (
          <button
            type="button"
            onClick={onToggleFavourite}
            aria-pressed={favourite}
            aria-label="Favourite"
            className={cx(
              "relative size-11 -mr-2 -mt-2 grid place-items-center rounded-full",
              "focus-visible:outline-2 focus-visible:outline-primary",
              favourite ? "text-primary" : "text-ink-subtle",
            )}
          >
            <Icon name="heart" className="size-6" filled={favourite} />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="clock" className="size-4" />
          <span className="tabular-nums">{formatMinutes(recipe.totalMins)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="flame" className="size-4" />
          <span className={cx("tabular-nums", !estimated && "text-ink font-medium")}>
            {approx(`${recipe.kcal} kcal`, estimated)}
          </span>
        </span>
        <span className="tabular-nums">
          {estimated ? (
            `~${recipe.proteinG}g protein`
          ) : (
            <>
              <span className="text-ink font-medium">{recipe.proteinG}g</span> protein
            </>
          )}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {recipe.carbs.map((carb) => (
          <Badge key={carb}>{carb}</Badge>
        ))}
        <CategoryBadge category={recipe.category} detail={recipe.categoryDetail} />
        <NutritionBadge source={recipe.nutritionSource} />
      </div>
    </article>
  );
}

/** Denser list row for long libraries. The left bar is the category colour. */
export function RecipeRow({ recipe }: { recipe: RecipeSummary }) {
  const estimated = recipe.nutritionSource === "estimated";
  const facts = [
    formatMinutes(recipe.totalMins),
    approx(`${recipe.kcal} kcal`, estimated),
    approx(`${recipe.proteinG}g protein`, estimated),
    ...recipe.carbs,
  ];
  return (
    <Link
      href={recipe.href}
      className="flex items-center gap-3 px-4 py-3 min-h-16 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      <span className={cx("w-1 self-stretch rounded-full", categoryDotClass(recipe.category))} aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{recipe.name}</span>
        <span className="sr-only">{categoryLabels[recipe.category]}</span>
        <span className="block text-sm text-ink-muted tabular-nums">{facts.join(" · ")}</span>
      </span>
      <Icon name="chevron-right" className="size-5 text-ink-subtle" />
    </Link>
  );
}
