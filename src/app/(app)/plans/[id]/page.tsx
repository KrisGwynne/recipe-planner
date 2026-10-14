import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icon } from "@/components/icon";
import { getPlan, requireHousehold } from "@/data";
import { addDays, formatRange, planEnd, today } from "@/plans/plan";
import { PlanBoard } from "./plan-board";
import { PlanMenu } from "./plan-menu";

type Props = { params: Promise<{ id: string }> };

// A meal plan (designs/src/meal-plans.html, D and I). Found by id within the
// household, so another household's plan is a 404. PP-170 shows the days and
// what's in them; PP-171 fills them (PlanBoard); totals come with PP-172.
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
        <PlanMenu
          plan={{ id: plan.id, name: plan.name, startDate: plan.startDate, days: plan.days, people: plan.people }}
          mealsByDay={mealsByDay}
          copyStart={addDays(planEnd(plan), 1)}
          today={todayDate}
        />
      </div>

      <PlanBoard
        plan={{ id: plan.id, name: plan.name, startDate: plan.startDate, days: plan.days, people: plan.people }}
        entries={plan.entries}
        today={todayDate}
      />
    </main>
  );
}
