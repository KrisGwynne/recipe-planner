import Link from "next/link";
import { cx } from "@/lib/cx";
import { approx, formatMinutes } from "@/lib/format";
import { Icon } from "@/components/icon";
import { Badge, CategoryBadge, NutritionBadge, categoryDotClasses, categoryLabels, type Category } from "./badge";

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
  /** Carb labels, e.g. ["Pasta"]. Empty: "No carbs". */
  carbs: string[];
  /** A variation without meat or fish: "+ Veggie option" (library design A). */
  veggieOption?: boolean;
  /** Search words to mark in the name (library design C). */
  highlight?: string[];
  /** When only an ingredient matched the search, which one (design C). */
  matchedIngredient?: string;
};

/** Text with each search word marked (library design C). */
export function Highlighted({ text, words = [] }: { text: string; words?: string[] }) {
  if (words.length === 0) return text;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-primary-soft text-ink rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

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
    <article className="relative h-full rounded-card bg-surface border border-line p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-primary">
      <div className="flex items-start gap-3">
        <h3 className="flex-1 font-display text-xl font-semibold leading-snug">
          <Link href={recipe.href} className="outline-none after:absolute after:inset-0 after:rounded-card">
            <Highlighted text={recipe.name} words={recipe.highlight} />
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
        {recipe.carbs.length === 0 ? (
          <Badge variant="muted">No carbs</Badge>
        ) : (
          recipe.carbs.map((carb) => <Badge key={carb}>{carb}</Badge>)
        )}
        <CategoryBadge category={recipe.category} detail={recipe.categoryDetail} />
        <NutritionBadge source={recipe.nutritionSource} />
      </div>
      {recipe.veggieOption && <p className="mt-2 text-sm text-veg font-medium">+ Veggie option</p>}
      {recipe.matchedIngredient && (
        <p className="mt-2 text-sm rounded-lg bg-surface-2 px-3 py-2">
          <span className="text-ink-muted">Ingredient:</span>{" "}
          <Highlighted text={recipe.matchedIngredient} words={recipe.highlight} />
        </p>
      )}
    </article>
  );
}

/**
 * Denser list row for long libraries (library design B). The left bar is the
 * category colour: meat & fish is split, meat above fish.
 */
export function RecipeRow({ recipe, emphasis }: { recipe: RecipeSummary; emphasis?: "time" | "kcal" | "protein" }) {
  const estimated = recipe.nutritionSource === "estimated";
  // The number being sorted on is bold (library design B).
  const facts: [string, boolean][] = [
    [formatMinutes(recipe.totalMins), emphasis === "time"],
    [approx(`${recipe.kcal} kcal`, estimated), emphasis === "kcal"],
    [approx(`${recipe.proteinG}g protein`, estimated), emphasis === "protein"],
    ...(recipe.carbs.length === 0 ? ["No carbs"] : recipe.carbs).map((c): [string, boolean] => [c, false]),
  ];
  return (
    <Link
      href={recipe.href}
      className="flex items-center gap-3 px-4 py-3 min-h-16 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      <span className="w-1 self-stretch flex flex-col rounded-full overflow-hidden" aria-hidden="true">
        {categoryDotClasses(recipe.category).map((dot) => (
          <span key={dot} className={cx("flex-1", dot)} />
        ))}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">
          <Highlighted text={recipe.name} words={recipe.highlight} />
        </span>
        <span className="sr-only">{categoryLabels[recipe.category]}</span>
        <span className="block text-sm text-ink-muted tabular-nums truncate">
          {facts.flatMap(([fact, bold], i) => [
            i > 0 ? " · " : "",
            bold ? (
              <b key={i} className="text-ink font-semibold">
                {fact}
              </b>
            ) : (
              fact
            ),
          ])}
        </span>
        {recipe.matchedIngredient && (
          <span className="block text-sm truncate">
            <span className="text-ink-muted">Ingredient:</span>{" "}
            <Highlighted text={recipe.matchedIngredient} words={recipe.highlight} />
          </span>
        )}
      </span>
    </Link>
  );
}
