"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Badge, CategoryBadge, DietaryBadge, NutritionBadge, dietaryLabels } from "@/components/ui/badge";
import { cx } from "@/lib/cx";
import { approx, formatMinutes } from "@/lib/format";
import { deriveColumns, macroEnergySplit, totalMins } from "@/recipes/derive";
import { groupIngredients, gramsTotal, notesFor, scaledAmount, scaledBanner } from "@/recipes/quantity";
import { toRecipeSummary } from "@/recipes/summary";
import type { Recipe, Variation } from "@/types/recipe";

const SECTIONS = [
  { id: "ingredients", label: "Ingredients" },
  { id: "method", label: "Method" },
  { id: "nutrition", label: "Nutrition" },
  { id: "notes", label: "Notes" },
] as const;

/**
 * A recipe page (designs/src/recipe.html A to G, without the household parts
 * that come with PP-169 and meal plans). Rendered from the recipe file alone,
 * so import can preview a file before it's saved. Servings and ticks last for
 * the visit only; a planned meal opens it at the servings planned.
 */
export function RecipeView({
  recipe,
  header,
  banner,
  initialServings,
}: {
  recipe: Recipe;
  /** The top bar's back and menu buttons. */
  header: ReactNode;
  /** Shown above the title, e.g. import's "not saved yet". */
  banner?: ReactNode;
  /** From a meal plan (design F's Recipe button); otherwise the recipe's own. */
  initialServings?: number;
}) {
  const summary = toRecipeSummary(deriveColumns(recipe));
  const [servings, setServings] = useState(initialServings ?? recipe.serves);
  const [gathered, setGathered] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState<string>("ingredients");
  const [scrolled, setScrolled] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // The title joins the top bar once the page has scrolled past it; the
  // section links follow the section on screen.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const title = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    if (top.current) title.observe(top.current);
    const sections = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) sections.observe(el);
    }
    return () => {
      title.disconnect();
      sections.disconnect();
    };
  }, []);

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  };

  const n = recipe.nutrition_per_serving;
  const estimated = n.source === "estimated";
  const nextStep = recipe.method.findIndex((_, i) => !done.has(i));
  const scaledNote = scaledBanner(recipe.serves, servings);
  const carbs = summary.carbs;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="sticky top-0 z-30 bg-bg/95 backdrop-blur">
        <div className="px-3 pt-3 flex items-center gap-1">
          {header}
        </div>
        <p
          aria-hidden={!scrolled}
          className={cx(
            "px-5 font-display font-semibold truncate transition-opacity",
            scrolled ? "opacity-100" : "opacity-0 h-0 overflow-hidden",
          )}
        >
          {recipe.name}
        </p>
        <nav
          aria-label="Sections"
          className={cx("px-5 flex gap-5 text-sm font-semibold border-b border-line", !scrolled && "sr-only")}
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={current === s.id ? "true" : undefined}
              className={cx("py-2 border-b-2", current === s.id ? "border-primary text-primary" : "border-transparent text-ink-muted")}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="px-5 pb-10">
        {/* A. Top of the page */}
        <div ref={top}>
          {banner}
          <h1 className="font-display text-[28px] leading-[34px] font-semibold mt-1">{recipe.name}</h1>
          <p className="mt-2 text-sm text-ink-muted inline-flex items-center gap-1.5">
            <Icon name="book" className="size-4 shrink-0" />
            {recipe.source.title}
            {recipe.source.details && ` · ${recipe.source.details}`}
          </p>
          {recipe.description && <p className="mt-3 text-[17px] leading-[26px] text-ink-muted">{recipe.description}</p>}
        </div>

        <Times recipe={recipe} />

        <div className="mt-4 flex flex-wrap gap-2">
          {carbs.length === 0 ? (
            <Badge variant="muted">No carbs</Badge>
          ) : (
            carbs.map((carb, i) => (
              <Badge key={carb}>
                {carb}
                {i === 0 && recipe.carb_detail && ` · ${recipe.carb_detail}`}
              </Badge>
            ))
          )}
          <CategoryBadge category={summary.category} detail={summary.categoryDetail} />
          <Badge>{word(recipe.cuisine)}</Badge>
          <Badge>{word(recipe.difficulty)}</Badge>
          {recipe.spice_level !== "none" && <Badge>{word(recipe.spice_level)} spice</Badge>}
          {recipe.equipment.map((e) => (
            <Badge key={e}>{word(e)}</Badge>
          ))}
          {recipe.dietary.map((d) => (
            <DietaryBadge key={d} flag={d} />
          ))}
        </div>

        <a
          href="#nutrition"
          className={cx(
            "mt-4 flex items-center gap-4 rounded-card bg-surface border p-4 hover:bg-surface-2",
            estimated ? "border-dashed border-ink-subtle" : "border-line",
          )}
        >
          <span className="flex-1">
            <span className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">Per serving</span>
              <NutritionBadge source={n.source} />
            </span>
            <span className="mt-1 block tabular-nums">
              <span className={cx("text-2xl font-semibold", estimated && "text-ink-muted")}>{approx(String(n.kcal), estimated)}</span>{" "}
              <span className="text-ink-muted">kcal</span>{" "}
              <span className={cx("ml-2 text-lg font-semibold", estimated && "text-ink-muted")}>{approx(`${n.protein_g}g`, estimated)}</span>{" "}
              <span className="text-ink-muted">protein</span>
            </span>
          </span>
          <Icon name="chevron-right" className="size-5 text-ink-subtle" />
        </a>

        {/* B, C. Ingredients */}
        <section id="ingredients" aria-labelledby="ingredients-title" className="mt-8 scroll-mt-28">
          <div className="flex items-center justify-between gap-3">
            <h2 id="ingredients-title" className="text-[17px] font-semibold">
              Ingredients
            </h2>
            <div className="flex items-center rounded-full border border-line bg-surface">
              <button
                type="button"
                aria-label="Fewer servings"
                disabled={servings <= 1}
                onClick={() => setServings((s) => s - 1)}
                className="size-11 grid place-items-center rounded-full disabled:text-ink-subtle focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Icon name="minus" className="size-5" />
              </button>
              <span aria-live="polite" className="min-w-24 text-center font-semibold tabular-nums">
                {servings === 1 ? "1 serving" : `${servings} servings`}
              </span>
              <button
                type="button"
                aria-label="More servings"
                disabled={servings >= 50}
                onClick={() => setServings((s) => s + 1)}
                className="size-11 grid place-items-center rounded-full disabled:text-ink-subtle focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Icon name="plus" className="size-5" />
              </button>
            </div>
          </div>
          {scaledNote && (
            <p className="mt-2 text-sm rounded-lg bg-primary-soft text-primary px-3 py-2 flex items-center justify-between">
              {scaledNote}
              <button type="button" onClick={() => setServings(recipe.serves)} className="font-semibold underline underline-offset-2">
                Reset
              </button>
            </p>
          )}
          {groupIngredients(recipe.ingredients).map(({ group, items }) => (
            <div key={group ?? ""}>
              {group && <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">{group}</h3>}
              <ul className={cx("divide-y divide-line", group ? "mt-1" : "mt-2")}>
                {items.map(({ ingredient: ing, index }) => {
                  const ticked = gathered.has(index);
                  const notes = notesFor(ing, recipe.serves, servings);
                  const grams = gramsTotal(ing, recipe.serves, servings);
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        aria-pressed={ticked}
                        onClick={() => setGathered((g) => toggle(g, index))}
                        className={cx(
                          "w-full py-3 flex gap-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                          ticked && "text-ink-subtle",
                        )}
                      >
                        <span className={cx("w-[4.5rem] shrink-0 font-semibold tabular-nums text-right", ticked && "line-through")}>
                          {scaledAmount(ing, recipe.serves, servings)}
                        </span>
                        {/* So screen readers hear "2 tbsp olive oil"; flex ignores it. */}{" "}
                        <span className="flex-1">
                          <span className={cx(ticked && "line-through")}>
                            {ing.item}
                            {ing.prep && (
                              <>
                                , <span className={cx(!ticked && "text-ink-muted")}>{ing.prep}</span>
                              </>
                            )}
                            {ing.optional && <span className={cx(!ticked && "text-ink-muted")}> (optional)</span>}
                          </span>
                          {(notes || grams) && (
                            <span className="block text-sm text-ink-subtle">
                              {notes?.text}
                              {notes?.forServes && <i> (for {notes.forServes})</i>}
                              {notes && grams && " · "}
                              {grams}
                            </span>
                          )}
                        </span>
                        {ticked && <Icon name="check" className="size-5 shrink-0 text-veg" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {/* D. Method (timers: PP-178) */}
        <section id="method" aria-labelledby="method-title" className="mt-8 scroll-mt-28">
          <h2 id="method-title" className="text-[17px] font-semibold">
            Method
          </h2>
          <ol className="mt-3 space-y-4">
            {recipe.method.map((step, i) => {
              const isDone = done.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    aria-pressed={isDone}
                    onClick={() => setDone((d) => toggle(d, i))}
                    className={cx(
                      "w-full flex gap-3 text-left rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      isDone && "opacity-60",
                    )}
                  >
                    <span
                      className={cx(
                        "size-8 shrink-0 rounded-full grid place-items-center font-semibold",
                        isDone ? "bg-veg-soft text-veg" : i === nextStep ? "bg-primary text-on-primary" : "bg-surface-2",
                      )}
                    >
                      {isDone ? <Icon name="check" className="size-4" strokeWidth={2.5} /> : i + 1}
                      <span className="sr-only">{isDone ? `Step ${i + 1}, done` : ""}</span>
                    </span>
                    <span className="flex-1 text-[17px] leading-[26px]">{step.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* E. Nutrition and variations */}
        <section id="nutrition" aria-labelledby="nutrition-title" className="mt-8 scroll-mt-28">
          <Nutrition recipe={recipe} />
          {recipe.variations.length > 0 && (
            <div className="mt-6">
              <h2 className="text-[17px] font-semibold">Variations</h2>
              <ul className="mt-2 space-y-2">
                {recipe.variations.map((v) => (
                  <li key={v.name} className="rounded-control bg-surface border border-line p-3">
                    <p className="font-semibold">{v.name}</p>
                    <p className="text-sm text-ink-muted">{v.description}</p>
                    {variationFacts(v) && <p className="mt-1 text-sm italic text-ink-muted">{variationFacts(v)}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* F. Recipe details (household notes, rating and history: PP-169) */}
        <section id="notes" aria-labelledby="notes-title" className="mt-8 scroll-mt-28">
          <h2 id="notes-title" className="text-[17px] font-semibold">
            From the recipe
          </h2>
          <dl className="mt-2 rounded-control bg-surface border border-line divide-y divide-line text-sm">
            <Detail label="Source">
              {recipe.source.url ? (
                <a href={recipe.source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
                  {recipe.source.title}
                </a>
              ) : (
                recipe.source.title
              )}
              <span className="block text-ink-muted">
                {word(recipe.source.kind)}
                {recipe.source.details && ` · ${recipe.source.details}`}
              </span>
            </Detail>
            <Detail label="Storage">
              {storageText(recipe.storage)}
              {recipe.storage.notes && <span className="block text-ink-muted">{recipe.storage.notes}</span>}
            </Detail>
            {recipe.tags.length > 0 && <Detail label="Tags">{recipe.tags.join(" · ")}</Detail>}
            {recipe.notes && <Detail label="Tips">{recipe.notes}</Detail>}
          </dl>
        </section>
      </div>
    </div>
  );
}

function Times({ recipe }: { recipe: Recipe }) {
  const t = recipe.times;
  const cells: [string, number][] = [
    ["Prep", t.prep_mins],
    ["Cook", t.cook_mins],
    ...(t.wait_mins > 0 ? ([["Waiting", t.wait_mins]] as [string, number][]) : []),
  ];
  return (
    <>
      <dl
        className={cx(
          "mt-4 grid rounded-card bg-surface border border-line divide-x divide-line text-center overflow-hidden",
          cells.length === 3 ? "grid-cols-4" : "grid-cols-3",
        )}
      >
        {cells.map(([label, mins]) => (
          <div key={label} className="py-3">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatMinutes(mins)}</dd>
          </div>
        ))}
        <div className="py-3 bg-surface-2">
          <dt className="text-xs text-ink-muted">Total</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatMinutes(totalMins(t))}</dd>
        </div>
      </dl>
      {t.notes && <p className="mt-1.5 text-xs text-ink-subtle">{t.notes}</p>}
    </>
  );
}

function Nutrition({ recipe }: { recipe: Recipe }) {
  const n = recipe.nutrition_per_serving;
  const estimated = n.source === "estimated";
  const split = macroEnergySplit(n);
  const g = (v: number) => approx(`${v} g`, estimated);
  const rows: [string, string, boolean][] = [
    ["Protein", g(n.protein_g), true],
    ["Carbs", g(n.carbs_g), true],
    ["of which sugars", g(n.sugars_g), false],
    ["Fat", g(n.fat_g), true],
    ["of which saturates", g(n.saturates_g), false],
    ["Fibre", g(n.fibre_g), true],
    ["Salt", g(n.salt_g), true],
  ];
  const parts = [
    { label: "Protein", value: split.protein, dot: "bg-veg" },
    { label: "Carbs", value: split.carbs, dot: "bg-primary" },
    { label: "Fat", value: split.fat, dot: "bg-warning" },
  ];
  const where = { book: "book", magazine: "magazine", website: "website", family: "recipe", other: "recipe" }[recipe.source.kind];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 id="nutrition-title" className="text-[17px] font-semibold">
          Nutrition per serving
        </h2>
        <NutritionBadge source={n.source} />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {estimated
          ? `Not printed in the ${where}; estimated by Claude when the recipe was imported.`
          : `As printed in the ${where}.`}
      </p>
      <div className={cx("mt-3 rounded-card bg-surface border p-4", estimated ? "border-dashed border-ink-subtle" : "border-line")}>
        <p className="tabular-nums">
          <span className={cx("text-3xl font-semibold", estimated && "text-ink-muted")}>{approx(String(n.kcal), estimated)}</span>{" "}
          <span className="text-ink-muted">kcal</span>
        </p>
        <div className="mt-3 flex h-3 rounded-full overflow-hidden bg-surface-2" aria-hidden="true">
          {parts.map((p) => (
            <span key={p.label} className={p.dot} style={{ width: `${p.value}%` }} />
          ))}
        </div>
        <p className="mt-2 flex justify-between text-xs text-ink-muted">
          {parts.map((p) => (
            <span key={p.label}>
              <span className={cx("inline-block size-2 rounded-full mr-1", p.dot)} aria-hidden="true" />
              {p.label} {Math.round(p.value)}%
            </span>
          ))}
        </p>
        <table className="mt-4 w-full text-sm tabular-nums">
          <caption className="sr-only">Nutrition per serving</caption>
          <tbody className="divide-y divide-line">
            {rows.map(([label, value, main]) => (
              <tr key={label}>
                <th scope="row" className={cx("py-1.5 text-left font-normal", !main && "pl-3 text-ink-muted")}>
                  {label}
                </th>
                <td className={cx("text-right", main && "font-semibold")}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs text-ink-subtle">Energy split: share of calories from protein, carbs and fat (4, 4 and 9 kcal per gram).</p>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="p-3 flex gap-3">
      <dt className="w-20 shrink-0 text-ink-muted">{label}</dt>
      <dd className="flex-1 min-w-0">{children}</dd>
    </div>
  );
}

/** "no meat or fish · Nut-free" (design E): only what the variation states. */
function variationFacts(v: Variation): string | undefined {
  const parts: string[] = [];
  if (v.proteins) {
    const meatOrFish = v.proteins.filter((p) => p.category !== "vegetarian");
    parts.push(meatOrFish.length === 0 ? "no meat or fish" : meatOrFish.map((p) => word(p.item)).join(", "));
  }
  if (v.dietary) parts.push(...v.dietary.map((d) => dietaryLabels[d]));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function storageText(storage: Recipe["storage"]): string {
  const freezer = storage.freezable === null ? "Freezing not stated" : storage.freezable ? "Freezable" : "Not freezable";
  const leftovers =
    storage.good_for_leftovers === null ? null : storage.good_for_leftovers ? "Good for leftovers" : "Not good for leftovers";
  return leftovers ? `${freezer} · ${leftovers}` : freezer;
}

/** "middle-eastern" -> "Middle eastern". */
function word(value: string): string {
  const spaced = value.replaceAll("-", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
