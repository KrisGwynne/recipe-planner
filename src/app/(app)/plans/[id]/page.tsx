import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icon } from "@/components/icon";
import { categoryDotClasses, categoryLabels, categoryOf } from "@/components/ui/badge";
import { getPlan, requireHousehold, type PlanEntry } from "@/data";
import { cx } from "@/lib/cx";
import { SLOTS, addDays, formatDay, formatPortions, formatRange, planDay, planEnd, slotLabels, today } from "@/plans/plan";
import { browsingCategory } from "@/recipes/derive";
import type { DietaryFlag } from "@/types/recipe";
import { PlanMenu } from "./plan-menu";

type Props = { params: Promise<{ id: string }> };

// A meal plan (designs/src/meal-plans.html, D and I). Found by id within the
// household, so another household's plan is a 404. PP-170 shows the days and
// what's in them; adding recipes, the day strip and totals come with PP-171
// and PP-172.
const findPlan = cache(async (id: string) => {
  const { ctx } = await requireHousehold();
  return getPlan(ctx, id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = await findPlan((await params).id);
  return { title: plan?.name ?? "Meal plan" };
}

export default async function PlanPage({ params }: Props) {
  const plan = await findPlan((await params).id);
  if (!plan) notFound();
  const todayDate = today();

  const mealsByDay = Array.from({ length: plan.days }, (_, day) =>
    new Set(plan.entries.filter((e) => e.dayIndex === day).map((e) => e.slot)).size,
  );

  return (
    <main className="mx-auto max-w-xl pb-6">
      <div className="px-3 pt-3 flex items-center gap-1 md:pt-6">
        <Link
          href="/plans"
          aria-label="Back to plans"
          className="size-11 shrink-0 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Icon name="arrow-left" className="size-6" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[22px] leading-7 font-semibold truncate">{plan.name}</h1>
          <p className="text-sm text-ink-muted">
            {formatRange(plan)} · {plan.people === 1 ? "1 person" : `${plan.people} people`}
          </p>
        </div>
        <PlanMenu
          plan={{ id: plan.id, name: plan.name, startDate: plan.startDate, days: plan.days, people: plan.people }}
          mealsByDay={mealsByDay}
          copyStart={addDays(planEnd(plan), 1)}
          today={todayDate}
        />
      </div>

      <ol className="mt-3 px-5 space-y-3">
        {mealsByDay.map((count, dayIndex) => {
          const date = planDay(plan, dayIndex);
          const entries = plan.entries.filter((e) => e.dayIndex === dayIndex);
          return (
            <li
              key={date}
              id={`day-${dayIndex}`}
              className={cx(
                "rounded-card px-4 pt-3 pb-3",
                count > 0 ? "bg-surface border border-line" : "border border-dashed border-line",
              )}
            >
              <div className="flex items-baseline gap-2">
                <h2 className="font-semibold">{formatDay(date)}</h2>
                {date === todayDate && (
                  <span className="h-5 px-1.5 rounded-full bg-primary-soft text-primary text-xs font-semibold inline-flex items-center">
                    Today
                  </span>
                )}
                {count === 0 && <p className="ml-auto text-sm text-ink-subtle">Nothing planned</p>}
              </div>
              {SLOTS.map((slot) => {
                const inSlot = entries.filter((e) => e.slot === slot);
                if (inSlot.length === 0) return null;
                return (
                  <section key={slot} aria-label={slotLabels[slot]}>
                    <h3 className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">{slotLabels[slot]}</h3>
                    <ul>
                      {inSlot.map((entry) => (
                        <EntryRow key={entry.id} entry={entry} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </li>
          );
        })}
      </ol>
    </main>
  );
}

/** A recipe in a meal: category bar, name and portions each. Opens the recipe until the entry sheet (PP-171). */
function EntryRow({ entry }: { entry: PlanEntry }) {
  const category = categoryOf(browsingCategory(entry.recipe.proteinType, entry.recipe.dietary as DietaryFlag[]));
  return (
    <li>
      <Link
        href={`/recipes/${entry.recipe.slug}`}
        className="mt-1 flex items-center gap-3 min-h-12 rounded-control focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="w-1 self-stretch flex flex-col rounded-full overflow-hidden" aria-hidden="true">
          {categoryDotClasses(category).map((dot) => (
            <span key={dot} className={cx("flex-1", dot)} />
          ))}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold leading-snug">{entry.recipe.name}</span>
          <span className="sr-only">{categoryLabels[category]}</span>
          <span className="block text-sm text-ink-muted tabular-nums">{formatPortions(entry.portionsPerPerson)} each</span>
        </span>
      </Link>
    </li>
  );
}
