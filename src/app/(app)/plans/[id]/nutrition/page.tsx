import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icon } from "@/components/icon";
import { EnergySplit } from "@/components/recipe/energy-split";
import { NutritionBadge } from "@/components/ui/badge";
import { getPlan, requireHousehold } from "@/data";
import { cx } from "@/lib/cx";
import { approx } from "@/lib/format";
import { andList, dayTotals, estimatedRecipes, grams, planAverage, whole } from "@/plans/nutrition";
import { SLOTS, formatDay, meals, planDay } from "@/plans/plan";

type Props = { params: Promise<{ id: string }> };

// A plan's nutrition, each person (designs/src/meal-plans.html H; PP-172):
// the day on average over the days with something planned, then each day.
// Found by id within the household, so another household's plan is a 404.
const findPlan = cache(async (id: string) => {
  const { ctx } = await requireHousehold();
  return getPlan(ctx, id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = await findPlan((await params).id);
  return { title: plan ? `Nutrition · ${plan.name}` : "Nutrition" };
}

export default async function PlanNutritionPage({ params }: Props) {
  const plan = await findPlan((await params).id);
  if (!plan) notFound();
  const average = planAverage(plan.entries, plan.days);
  const days = Array.from({ length: plan.days }, (_, dayIndex) => {
    const entries = plan.entries.filter((e) => e.dayIndex === dayIndex);
    return {
      dayIndex,
      // "Mon", or "Mon 12" when a plan has two Mondays.
      weekday: formatDay(planDay(plan, dayIndex)).split(" ").slice(0, plan.days > 7 ? 2 : 1).join(" "),
      // A meal with a curry and a side is one meal.
      meals: SLOTS.filter((slot) => entries.some((e) => e.slot === slot)).length,
      totals: dayTotals(plan.entries, dayIndex),
    };
  });
  const estimatedDays = days.filter((d) => d.totals?.estimated).map((d) => d.weekday);
  const estimated = estimatedRecipes(plan.entries);

  return (
    <main className="mx-auto max-w-xl pb-6">
      <div className="px-3 pt-3 flex items-center gap-1 md:pt-6">
        <Link
          href={`/plans/${plan.id}`}
          aria-label="Back to plan"
          className="size-11 shrink-0 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Icon name="arrow-left" className="size-6" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[22px] leading-7 font-semibold truncate">Nutrition</h1>
          <p className="text-sm text-ink-muted truncate">{plan.name} · each person</p>
        </div>
      </div>

      <div className="px-5 pt-3 space-y-4">
        {average ? (
          <section
            aria-label="A day on average"
            className={cx(
              "rounded-card bg-surface border p-4",
              average.estimated ? "border-dashed border-ink-subtle" : "border-line",
            )}
          >
            <p className="text-xs text-ink-muted">
              A day on average · {average.daysPlanned === 1 ? "1 day" : `${average.daysPlanned} days`} planned
            </p>
            <div className="mt-1 flex items-center justify-between">
              <p className="tabular-nums">
                <span className={cx("text-3xl font-semibold", average.estimated && "text-ink-muted")}>
                  {approx(whole(average.kcal), average.estimated)}
                </span>{" "}
                <span className="text-ink-muted">kcal</span>
              </p>
              {average.estimated && <NutritionBadge source="estimated" />}
            </div>
            <p className="mt-1 text-sm text-ink-muted tabular-nums">
              Protein <b className="text-ink">{grams(average.proteinG, average.estimated)}</b> · Carbs{" "}
              <b className="text-ink">{grams(average.carbsG, average.estimated)}</b> · Fat{" "}
              <b className="text-ink">{grams(average.fatG, average.estimated)}</b>
            </p>
            <EnergySplit proteinG={average.proteinG} carbsG={average.carbsG} fatG={average.fatG} />
          </section>
        ) : (
          <p className="rounded-card border border-dashed border-line p-4 text-ink-muted">
            Nothing planned yet. Add recipes to the plan to see what each person eats.
          </p>
        )}

        <section aria-labelledby="each-day">
          <h2 id="each-day" className="text-[17px] font-semibold">
            Each day
          </h2>
          <table className="mt-2 w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-ink-muted text-right">
                <th scope="col" className="text-left font-medium pb-1">
                  Day
                </th>
                <th scope="col" className="font-medium pb-1">
                  kcal
                </th>
                <th scope="col" className="font-medium pb-1">
                  Protein
                </th>
                <th scope="col" className="font-medium pb-1">
                  Carbs
                </th>
                <th scope="col" className="font-medium pb-1">
                  Fat
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-right">
              {days.map(({ dayIndex, weekday, meals: count, totals }) =>
                totals ? (
                  <tr key={dayIndex} className={cx(totals.estimated && "text-ink-muted")}>
                    <th scope="row" className="py-2 text-left font-medium text-ink">
                      {weekday} <span className="text-ink-muted font-normal">· {meals(count)}</span>
                    </th>
                    <td className="font-semibold">{approx(whole(totals.kcal), totals.estimated)}</td>
                    <td>{grams(totals.proteinG, totals.estimated)}</td>
                    <td>{grams(totals.carbsG, totals.estimated)}</td>
                    <td>{grams(totals.fatG, totals.estimated)}</td>
                  </tr>
                ) : (
                  <tr key={dayIndex} className="text-ink-subtle">
                    <th scope="row" className="py-2 text-left font-medium">
                      {weekday}
                    </th>
                    <td colSpan={4}>Nothing planned</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </section>

        {estimated.length > 0 && (
          <p className="text-sm text-ink-muted">
            ~ {andList(estimatedDays)} {estimatedDays.length === 1 ? "includes" : "include"}{" "}
            {estimated.length === 1 ? "a recipe" : "recipes"} with estimated nutrition: {estimated.join(", ")}.
          </p>
        )}
        <p className="text-sm text-ink-muted">
          Totals count only what&apos;s in the plan. Days with just a dinner planned will look light.
        </p>
      </div>
    </main>
  );
}
