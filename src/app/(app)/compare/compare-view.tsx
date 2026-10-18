import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { EnergySplit } from "@/components/recipe/energy-split";
import { CategoryBadge, NutritionBadge, categoryDotClasses, categoryLabels, dietaryLabels } from "@/components/ui/badge";
import { compareHref, barWidths, chooseHref, MAX_RECIPES } from "@/compare/compare";
import { cx } from "@/lib/cx";
import { approx, formatMinutes } from "@/lib/format";
import { deriveColumns, totalMins } from "@/recipes/derive";
import { carbLabel, itemLabel, word } from "@/recipes/library-filter";
import { toRecipeSummary } from "@/recipes/summary";
import type { Recipe } from "@/types/recipe";

// Comparing 2 to 4 recipes (designs/src/compare.html C to G): the chosen
// recipes, one chart per nutrient, where the calories come from, and a table
// of everything else. All per serving, as each recipe gives it.

export type Compared = { slug: string; recipe: Recipe };

type Nutrient = "kcal" | "protein_g" | "carbs_g" | "fat_g";

// Each chart wears the colour the energy split gives its nutrient. Written out
// in full so Tailwind finds the class names. Estimates get a dashed outline
// and a soft fill, never colour alone (foundations).
const CHARTS: { key: Nutrient; title: string; unit: string; suffix: string; spoken: string; bar: string; estimated: string }[] = [
  { key: "kcal", title: "Calories", unit: "kcal per serving", suffix: "", spoken: " kcal", bar: "bg-ink", estimated: "bg-surface-2 border border-dashed border-ink-subtle" },
  { key: "protein_g", spoken: "", title: "Protein", unit: "grams per serving", suffix: "g", bar: "bg-veg", estimated: "bg-veg-soft border border-dashed border-veg" },
  { key: "carbs_g", spoken: "", title: "Carbs", unit: "grams per serving", suffix: "g", bar: "bg-primary", estimated: "bg-primary-soft border border-dashed border-primary" },
  { key: "fat_g", spoken: "", title: "Fat", unit: "grams per serving", suffix: "g", bar: "bg-warning", estimated: "bg-warning-soft border border-dashed border-warning" },
];

const isEstimated = (recipe: Recipe) => recipe.nutrition_per_serving.source === "estimated";

/** "672", "~825"; whole numbers except salt, which is small enough to need a decimal. */
function amount(value: number, estimated: boolean, suffix = "") {
  const shown = Number.isInteger(value) ? value.toLocaleString("en-GB") : String(Math.round(value * 10) / 10);
  return approx(`${shown}${suffix}`, estimated);
}

export function CompareView({ compared }: { compared: Compared[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8">
      <div className="space-y-4">
        <Chosen compared={compared} />
        <Split compared={compared} className="hidden md:block" />
      </div>
      <div className="grid gap-4 content-start lg:grid-cols-2">
        {CHARTS.map((chart) => (
          <NutrientChart key={chart.key} chart={chart} compared={compared} />
        ))}
      </div>
      <Split compared={compared} className="md:hidden" />
      <section aria-labelledby="side-by-side" className="md:col-span-2 md:mt-4">
        <h2 id="side-by-side" className="text-[17px] font-semibold">
          Side by side
        </h2>
        <CompareTable compared={compared} />
      </section>
    </div>
  );
}

/** The chosen recipes, each with its source of nutrition (design C), and Add (or the limit, F). */
export function Chosen({ compared }: { compared: Compared[] }) {
  const slugs = compared.map((c) => c.slug);
  return (
    <ul aria-label="Recipes being compared" className="rounded-card bg-surface border border-line divide-y divide-line">
      {compared.map(({ slug, recipe }) => {
        const summary = toRecipeSummary(deriveColumns(recipe));
        return (
          <li key={slug} className="flex items-center gap-3 pl-4 pr-1 py-2 min-h-14">
            <span className="w-1 self-stretch flex flex-col rounded-full overflow-hidden" aria-hidden="true">
              {categoryDotClasses(summary.category).map((dot) => (
                <span key={dot} className={cx("flex-1", dot)} />
              ))}
            </span>
            <span className="flex-1 min-w-0">
              <Link href={`/recipes/${slug}`} className="block font-semibold leading-snug line-clamp-2 hover:underline">
                {recipe.name}
              </Link>
              <span className="sr-only">{categoryLabels[summary.category]}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted tabular-nums">
                <span className="whitespace-nowrap">
                  {formatMinutes(totalMins(recipe.times))} · serves {recipe.serves}
                </span>
                <NutritionBadge source={recipe.nutrition_per_serving.source} />
              </span>
            </span>
            <Link
              href={compareHref(slugs.filter((s) => s !== slug))}
              replace
              aria-label={`Remove ${recipe.name} from the comparison`}
              className="size-11 shrink-0 rounded-full grid place-items-center text-ink-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Icon name="x" className="size-5" />
            </Link>
          </li>
        );
      })}
      <li>
        {compared.length >= MAX_RECIPES ? (
          <p className="px-4 py-3 text-sm text-ink-muted">4 is the most. Remove one to add another.</p>
        ) : (
          <Link
            href={chooseHref(slugs)}
            className="w-full h-12 px-4 flex items-center gap-2 font-semibold text-primary rounded-b-card hover:bg-surface-2"
          >
            <Icon name="plus" className="size-5" />
            Add a recipe
          </Link>
        )}
      </li>
    </ul>
  );
}

/** How far apart the bars in a chart start drawing in (PP-184). */
const BAR_STAGGER_MS = 80;

/** One chart per nutrient (design C, D): kcal and grams don't share a scale. Every value is written on its bar. */
function NutrientChart({ chart, compared }: { chart: (typeof CHARTS)[number]; compared: Compared[] }) {
  const values = compared.map((c) => c.recipe.nutrition_per_serving[chart.key]);
  const widths = barWidths(values);
  return (
    <figure aria-labelledby={`chart-${chart.key}`} className="rounded-card bg-surface border border-line p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span id={`chart-${chart.key}`} className="font-semibold">
          {chart.title}
        </span>
        <span className="text-xs text-ink-muted">{chart.unit}</span>
      </figcaption>
      <ul className="mt-3 space-y-3">
        {compared.map(({ slug, recipe }, i) => {
          const estimated = isEstimated(recipe);
          return (
            <li key={slug}>
              <p className="text-sm text-ink-muted truncate">{recipe.name}</p>
              <div className="mt-1 flex items-center gap-2 border-l border-line">
                <span
                  aria-hidden="true"
                  className={cx(
                    "h-3.5 rounded-r-[4px] motion-safe:animate-bar-in motion-safe:transition-[width] motion-safe:duration-300",
                    estimated ? chart.estimated : chart.bar,
                  )}
                  // Each recipe's bar starts a little after the one above (PP-184).
                  style={{ width: `${widths[i]}%`, animationDelay: `${i * BAR_STAGGER_MS}ms` }}
                />
                <span className={cx("text-sm tabular-nums", estimated ? "font-medium text-ink-muted" : "font-semibold")}>
                  {amount(values[i], estimated, chart.suffix)}
                  {chart.spoken && <span className="sr-only">{chart.spoken}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** Where the calories come from (design D): the recipe page's energy split, one per recipe. */
function Split({ compared, className }: { compared: Compared[]; className?: string }) {
  return (
    <section aria-labelledby={`split-${className ?? ""}`} className={cx("rounded-card bg-surface border border-line p-4", className)}>
      <h2 id={`split-${className ?? ""}`} className="font-semibold">
        Where the calories come from
      </h2>
      <ul className="mt-1 space-y-4">
        {compared.map(({ slug, recipe }) => {
          const n = recipe.nutrition_per_serving;
          return (
            <li key={slug} className="pt-2">
              <p className="text-sm font-medium truncate">{recipe.name}</p>
              <EnergySplit proteinG={n.protein_g} carbsG={n.carbs_g} fatG={n.fat_g} estimated={isEstimated(recipe)} />
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-subtle">Share of calories from protein, carbs and fat (4, 4 and 9 kcal per gram).</p>
    </section>
  );
}

const NUTRIENTS: { key: Exclude<keyof Recipe["nutrition_per_serving"], "source">; label: string; suffix: string }[] = [
  { key: "kcal", label: "Calories", suffix: " kcal" },
  { key: "protein_g", label: "Protein", suffix: "g" },
  { key: "carbs_g", label: "Carbs", suffix: "g" },
  { key: "sugars_g", label: "Sugars", suffix: "g" },
  { key: "fat_g", label: "Fat", suffix: "g" },
  { key: "saturates_g", label: "Saturates", suffix: "g" },
  { key: "fibre_g", label: "Fibre", suffix: "g" },
  { key: "salt_g", label: "Salt", suffix: "g" },
];

function timeDetail(t: Recipe["times"]): string {
  const parts = [`${t.prep_mins} prep`, `${t.cook_mins} cook`];
  if (t.wait_mins > 0) parts.push(`${t.wait_mins} wait`);
  return parts.join(" · ");
}

/**
 * Everything side by side (design E, G). On a phone, more than two recipes
 * scroll sideways with the row labels pinned, so part of the next column
 * shows there's more. Dietary says only what the recipe's list says. "Carb
 * type" and "Protein type" keep those rows apart from the nutrients below.
 */
function CompareTable({ compared }: { compared: Compared[] }) {
  const cellWidth = compared.length > 2 ? "min-w-[112px] md:min-w-0" : "";
  const row = (label: string, cell: (recipe: Recipe) => ReactNode) => (
    <tr>
      <th scope="row" className="sticky left-0 z-10 bg-surface w-20 min-w-20 align-top text-left font-medium text-ink-muted pl-3 pr-1 py-2">
        {label}
      </th>
      {compared.map(({ slug, recipe }) => (
        <td key={slug} className={cx(cellWidth, "align-top px-2 py-2")}>
          {cell(recipe)}
        </td>
      ))}
    </tr>
  );
  const value = (recipe: Recipe, n: number, suffix: string) =>
    isEstimated(recipe) ? <span className="text-ink-muted">{amount(n, true, suffix)}</span> : <span className="font-medium">{amount(n, false, suffix)}</span>;

  return (
    <div className="mt-2 rounded-card bg-surface border border-line overflow-x-auto">
      <table className="w-full text-sm tabular-nums border-collapse md:table-fixed">
        <thead>
          <tr className="border-b border-line">
            <td className="sticky left-0 z-10 bg-surface w-20 min-w-20" />
            {compared.map(({ slug, recipe }) => (
              <th key={slug} scope="col" className={cx(cellWidth, "align-bottom text-left px-2 pt-3 pb-2")}>
                <span className="font-display font-semibold leading-snug line-clamp-3">{recipe.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {row("Time", (r) => (
            <>
              <span className="font-semibold">{formatMinutes(totalMins(r.times))}</span>
              <span className="block text-xs text-ink-muted">{timeDetail(r.times)}</span>
            </>
          ))}
          {row("Serves", (r) => r.serves)}
          {row("Carb type", (r) => r.carbs.map(carbLabel).join(", "))}
          {row("Protein type", (r) => (
            <>
              <CategoryBadge category={toRecipeSummary(deriveColumns(r)).category} />
              {r.proteins.length > 0 && (
                <span className="block mt-0.5">{r.proteins.map((p) => itemLabel(p.item)).join(", ")}</span>
              )}
            </>
          ))}
          {row("Dietary", (r) =>
            r.dietary.length > 0 ? (
              r.dietary.map((flag) => (
                <span key={flag} className="block">
                  {dietaryLabels[flag]}
                </span>
              ))
            ) : (
              <span className="text-ink-subtle">None listed</span>
            ),
          )}
          {row("Cuisine", (r) => word(r.cuisine))}
          {row("Difficulty", (r) => word(r.difficulty))}
          {row("Spice", (r) => word(r.spice_level))}
          <tr>
            <th colSpan={compared.length + 1} scope="colgroup" className="text-left pl-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Per serving
            </th>
          </tr>
          {row("Nutrition", (r) => (
            <span className="whitespace-nowrap">
              <NutritionBadge source={r.nutrition_per_serving.source} />
            </span>
          ))}
          {NUTRIENTS.map((n) => (
            <Fragment key={n.key}>{row(n.label, (r) => value(r, r.nutrition_per_serving[n.key], n.suffix))}</Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
