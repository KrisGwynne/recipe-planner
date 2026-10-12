import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Badge, CategoryBadge, NutritionBadge, categoryLabels, categoryOf, dietaryLabels } from "@/components/ui/badge";
import { cx } from "@/lib/cx";
import { approx, formatMinutes } from "@/lib/format";
import { browsingCategory, proteinType, totalMins } from "@/recipes/derive";
import type { Change, DiffLine } from "@/recipes/diff";
import type { ReviewItem } from "@/recipes/review";
import type { Problem } from "@/recipes/validate";
import type { Recipe } from "@/types/recipe";

// The parts of the import review (designs/src/import.html, screens B to E).

/** "Serves 2 · 55 min · ~825 kcal · Veg" */
function facts(recipe: Recipe): string {
  const estimated = recipe.nutrition_per_serving.source === "estimated";
  const category = categoryOf(browsingCategory(proteinType(recipe.proteins), recipe.dietary));
  return [
    `Serves ${recipe.serves}`,
    formatMinutes(totalMins(recipe.times)),
    approx(`${recipe.nutrition_per_serving.kcal} kcal`, estimated),
    categoryLabels[category],
  ].join(" · ");
}

/** One file in the review list. Ready files have a tick box; the rest of the row opens the details. */
export function ReviewRow({
  item,
  onOpen,
  ticked,
  onToggle,
}: {
  item: ReviewItem;
  onOpen: () => void;
  ticked?: boolean;
  onToggle?: () => void;
}) {
  if (item.status === "unchanged") return null;
  const problems = item.status === "problems";
  const title = problems ? (item.name ?? item.file) : item.recipe.name;

  let line: string;
  if (item.status === "new") line = facts(item.recipe);
  else if (item.status === "update") {
    const n = item.changes.length;
    line = `${n === 1 ? "1 thing changes" : `${n} things change`} · your notes and rating are kept`;
  } else line = item.whole ? item.problems[0].title : item.problems.length === 1 ? "1 problem to fix in Claude" : `${item.problems.length} problems to fix in Claude`;

  return (
    <li
      className={cx(
        "relative rounded-card border p-4 flex items-start gap-3",
        problems ? "border-danger/40 bg-danger-soft" : "bg-surface border-line",
      )}
    >
      {onToggle ? (
        <input
          type="checkbox"
          checked={ticked}
          onChange={onToggle}
          aria-label={`Import ${title}`}
          className="relative z-10 mt-0.5 size-6 shrink-0 accent-primary"
        />
      ) : (
        <Icon name="alert" className="mt-0.5 size-6 shrink-0 text-danger" />
      )}
      <span className="flex-1 min-w-0">
        {item.status !== "problems" ? (
          <span className="flex items-center gap-2">
            <StatusPill status={item.status} />
            <span className="text-xs text-ink-subtle truncate">{item.file}</span>
          </span>
        ) : (
          <span className="block text-xs text-ink-subtle truncate">{item.file}</span>
        )}
        <button
          type="button"
          onClick={onOpen}
          className={cx(
            "block mt-1 text-left after:absolute after:inset-0 after:rounded-card focus-visible:outline-none",
            problems ? "font-semibold" : "font-display text-lg font-semibold leading-snug",
          )}
        >
          {title}
        </button>
        <span className={cx("block text-sm", problems ? "text-danger" : "text-ink-muted")}>{line}</span>
      </span>
      <Icon name="chevron-right" className="mt-1 size-5 text-ink-subtle" />
    </li>
  );
}

function StatusPill({ status }: { status: "new" | "update" }) {
  return status === "new" ? (
    <span className="inline-flex h-6 px-2 rounded-full bg-primary-soft text-primary text-xs font-semibold items-center">New</span>
  ) : (
    <span className="inline-flex h-6 px-2 rounded-full bg-surface-2 text-ink text-xs font-semibold items-center border border-line">
      Update
    </span>
  );
}

export function UnchangedNote({ items }: { items: Extract<ReviewItem, { status: "unchanged" }>[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li key={item.file} className="text-sm text-ink-muted rounded-control bg-surface-2 px-4 py-3">
          {item.name}: identical to the saved recipe, skipped.
        </li>
      ))}
    </ul>
  );
}

// --- C. A new recipe ---

export function NewRecipe({ recipe, header, footer }: { recipe: Recipe; header: ReactNode; footer: ReactNode }) {
  const n = recipe.nutrition_per_serving;
  const estimated = n.source === "estimated";
  const { prep_mins, cook_mins, wait_mins } = recipe.times;
  const time = [
    `${prep_mins} prep`,
    `${cook_mins} cook`,
    wait_mins > 0 && `${wait_mins} waiting`,
  ]
    .filter(Boolean)
    .join(" · ");
  const groups = new Set(recipe.ingredients.map((i) => i.group).filter(Boolean)).size;
  const carbs = recipe.carbs[0] === "none" ? null : recipe.carbs.map(word).join(", ");
  const rows: [string, string][] = [
    ["Serves", String(recipe.serves)],
    ["Time", `${time} = ${formatMinutes(totalMins(recipe.times))}`],
    ["Per serving", `${approx(`${n.kcal} kcal`, estimated)} · ${approx(`${n.protein_g}g protein`, estimated)}`],
    ["Suitable for", recipe.dietary.length > 0 ? recipe.dietary.map((d) => dietaryLabels[d]).join(" · ") : "Not marked"],
    ["Ingredients", groups > 1 ? `${recipe.ingredients.length}, in ${groups} groups` : String(recipe.ingredients.length)],
    ["Method", recipe.method.length === 1 ? "1 step" : `${recipe.method.length} steps`],
    ["Variations", recipe.variations.length > 0 ? recipe.variations.map((v) => v.name).join(", ") : "None"],
  ];

  return (
    <>
      {header}
      <main className="mx-auto max-w-xl px-5 pb-28 md:pb-6">
        <h1 className="font-display text-[26px] leading-8 font-semibold">{recipe.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {recipe.source.title}
          {recipe.source.details && ` · ${recipe.source.details}`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {carbs ? (
            <Badge>
              {carbs}
              {recipe.carb_detail && ` · ${recipe.carb_detail}`}
            </Badge>
          ) : (
            <Badge variant="muted">No carbs</Badge>
          )}
          <CategoryBadge category={categoryOf(browsingCategory(proteinType(recipe.proteins), recipe.dietary))} />
          <NutritionBadge source={n.source} />
        </div>
        <dl className="mt-4 rounded-card bg-surface border border-line divide-y divide-line text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="px-4 py-2.5 flex justify-between gap-4">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-muted">
          Worth a quick check that Claude read the photo right: the category, carbs and dietary flags drive the filters.
        </p>
      </main>
      {footer}
    </>
  );
}

// --- D. An update ---

export function UpdateDetail({
  recipe,
  changes,
  header,
  footer,
}: {
  recipe: Recipe;
  changes: Change[];
  header: ReactNode;
  footer: ReactNode;
}) {
  return (
    <>
      {header}
      <main className="mx-auto max-w-xl px-5 pb-28 md:pb-6">
        <h1 className="font-display text-[26px] leading-8 font-semibold">{recipe.name}</h1>
        <p className="mt-2 text-ink-muted">
          This file replaces the saved recipe.{" "}
          <b className="text-ink">{changes.length === 1 ? "1 thing changes:" : `${changes.length} things change:`}</b>
        </p>
        <ul className="mt-3 space-y-2">
          {changes.map((change) => (
            <li key={change.field} className="rounded-control bg-surface border border-line p-3">
              <p className="font-semibold">{change.label}</p>
              <div className="mt-1 space-y-0.5 text-sm tabular-nums">
                {change.lines.map((line, i) => (
                  <ChangeLine key={i} line={line} />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-control bg-veg-soft text-ink px-4 py-3 text-sm flex gap-2">
          <Icon name="check" className="size-5 shrink-0 text-veg" />
          <span>
            Kept: favourite, rating, your notes and cooking history. Meal plans that use this recipe will show the new
            version.
          </span>
        </div>
      </main>
      {footer}
    </>
  );
}

function ChangeLine({ line }: { line: DiffLine }) {
  switch (line.kind) {
    case "added":
      return <p className="text-veg font-medium">+ {line.text}</p>;
    case "removed":
      return <p className="text-danger font-medium">− {line.text}</p>;
    case "changed":
      return <p className="text-ink-muted">{line.label ? `${line.label} changed` : "Changed"}</p>;
    case "change":
      return (
        <p>
          {line.label && <span className="text-ink-muted">{line.label}: </span>}
          <span className="line-through text-ink-subtle">{line.before}</span> → <b>{line.after}</b>
        </p>
      );
  }
}

// --- E. Problems ---

export function ProblemList({ problems }: { problems: Problem[] }) {
  return (
    <ol className="mt-3 space-y-2">
      {problems.map((p, i) => (
        <li key={i} className="rounded-control bg-surface border border-line p-3">
          <p className="font-semibold">{p.title}</p>
          <p className="mt-1 text-sm text-ink-muted">{p.detail}</p>
          {p.path && <code className="mt-2 block text-xs text-ink-subtle">{p.path}</code>}
        </li>
      ))}
    </ol>
  );
}

/** "middle-eastern" -> "Middle eastern". */
function word(value: string): string {
  const spaced = value.replaceAll("-", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
