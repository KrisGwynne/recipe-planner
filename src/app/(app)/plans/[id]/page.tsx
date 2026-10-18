import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icon } from "@/components/icon";
import { getPlan, nextPlan, requireHousehold } from "@/data";
import { planAverage } from "@/plans/nutrition";
import { addDays, formatRange, planEnd, today } from "@/plans/plan";
import { PlanAverage } from "./plan-average";
import { PlanBoard } from "./plan-board";
import { PlanMenu } from "./plan-menu";

type Props = { params: Promise<{ id: string }> };

// A meal plan (designs/src/meal-plans.html, D and I). Found by id within the
// household, so another household's plan is a 404. PP-170 shows the days and
// what's in them; PP-171 fills them (PlanBoard); PP-172 adds the totals.
const findPlan = cache(async (id: string) => {
  const { ctx } = await requireHousehold();
  return getPlan(ctx, id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = await findPlan((await params).id);
  return { title: plan?.name ?? "Meal plan" };
}

export default async function PlanPage({ params }: Props) {
  const { id } = await params;
  const plan = await findPlan(id);
  if (!plan) notFound();
  // For planning leftovers next week (leftovers design C).
  const { ctx } = await requireHousehold();
  const next = await nextPlan(ctx, plan.id);
  const todayDate = today();
  const average = planAverage(plan.entries, plan.days);

  const mealsByDay = Array.from({ length: plan.days }, (_, day) =>
    new Set(plan.entries.filter((e) => e.dayIndex === day).map((e) => e.slot)).size,
  );

  // Leftovers meals in other plans eating from each day's cooks, for the edit and delete warnings.
  const leftoversElsewhere = Array.from({ length: plan.days }, (_, day) =>
    plan.entries
      .filter((e) => e.dayIndex === day)
      .reduce((sum, e) => sum + e.leftoversTo.filter((m) => m.planId !== plan.id).length, 0),
  );

  return (
    <main className="mx-auto max-w-xl pb-6 md:max-w-none">
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
        {average && (
          <div className="hidden md:block ml-3">
            <PlanAverage planId={plan.id} average={average} wide />
          </div>
        )}
        <PlanMenu
          plan={{ id: plan.id, name: plan.name, startDate: plan.startDate, days: plan.days, people: plan.people }}
          mealsByDay={mealsByDay}
          leftoversElsewhere={leftoversElsewhere}
          copyStart={addDays(planEnd(plan), 1)}
          today={todayDate}
        />
      </div>

      {average && (
        <div className="px-5 pt-3 md:hidden">
          <PlanAverage planId={plan.id} average={average} />
        </div>
      )}

      <PlanBoard
        plan={{ id: plan.id, name: plan.name, startDate: plan.startDate, days: plan.days, people: plan.people }}
        next={next}
        entries={plan.entries}
        today={todayDate}
      />
    </main>
  );
}
