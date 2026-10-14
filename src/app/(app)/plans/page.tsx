import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Page } from "@/components/page";
import { listPlans, requireHousehold, type PlanSummary } from "@/data";
import { cx } from "@/lib/cx";
import { kcal } from "@/plans/nutrition";
import { defaultPlanName, defaultStartDate, formatRange, groupPlans, meals, planDay, today } from "@/plans/plan";
import { NewPlan } from "./new-plan";
import { PastPlans } from "./past-plans";

export const metadata: Metadata = { title: "Meal plans" };

// The Plans tab (designs/src/meal-plans.html, A and B; PP-170).
export default async function PlansPage() {
  const { ctx } = await requireHousehold();
  const plans = await listPlans(ctx);
  const todayDate = today();
  const startDate = defaultStartDate(plans, todayDate);
  const newPlan = {
    initial: { name: defaultPlanName(startDate), startDate, days: 7, people: 2 },
    today: todayDate,
    startHint: plans.length > 0 && startDate !== todayDate ? "The day after your latest plan ends" : undefined,
  };

  if (plans.length === 0) {
    return (
      <Page title="Plans">
        <div className="mx-auto max-w-sm px-3 pt-12 text-center">
          <span className="mx-auto size-16 rounded-full bg-primary-soft text-primary grid place-items-center">
            <Icon name="calendar" className="size-8" />
          </span>
          <p className="font-display text-[22px] font-semibold mt-5">No meal plans yet</p>
          <p className="text-ink-muted mt-2">
            Plan a week of meals from your recipes, see what each person eats a day, and spot where there&apos;ll be
            leftovers.
          </p>
          <NewPlan {...newPlan} variant="empty" />
        </div>
      </Page>
    );
  }

  const { current, upcoming, past } = groupPlans(plans, todayDate);
  return (
    <Page title="Plans">
      <div className="max-w-xl space-y-3 pb-20">
        {current.length > 0 && (
          <Group label="This week">
            {current.map((plan) => (
              <PlanCard key={plan.id} plan={plan} today={todayDate} />
            ))}
          </Group>
        )}
        {upcoming.length > 0 && (
          <Group label="Coming up">
            {upcoming.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </Group>
        )}
        {past.length > 0 && (
          <Group label="Past">
            <PastPlans
              plans={past.map((plan) => ({
                id: plan.id,
                name: plan.name,
                detail: `${formatRange(plan, { weekdays: false })} · ${meals(mealCount(plan))}`,
              }))}
            />
          </Group>
        )}
      </div>
      <NewPlan {...newPlan} variant="floating" />
    </Page>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pb-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</h2>
      {children}
    </section>
  );
}

function mealCount(plan: PlanSummary) {
  return plan.mealsByDay.reduce((sum, n) => sum + n, 0);
}

/**
 * A plan covering today shows its meals per day, today in solid tomato
 * and each person's kcal a day on average (design A); one to come says how
 * many days are still empty.
 */
function PlanCard({ plan, today }: { plan: PlanSummary; today?: string }) {
  const emptyDays = plan.mealsByDay.filter((n) => n === 0).length;
  return (
    <Link
      href={`/plans/${plan.id}`}
      className="block rounded-card bg-surface border border-line p-4 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="flex items-start gap-3">
        <span className="flex-1 min-w-0">
          <span className="block font-display text-xl font-semibold leading-snug">{plan.name}</span>
          <span className="block text-sm text-ink-muted mt-0.5">
            {formatRange(plan)} · {plan.people === 1 ? "1 person" : `${plan.people} people`}
          </span>
        </span>
        <Icon name="chevron-right" className="size-5 mt-1 text-ink-subtle" />
      </span>
      {today && (
        <span className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-ink-muted" aria-hidden="true">
          {plan.mealsByDay.map((count, dayIndex) => {
            const date = planDay(plan, dayIndex);
            return (
              <span key={date}>
                <span
                  className={cx(
                    "h-7 rounded-md grid place-items-center text-xs font-semibold",
                    date === today
                      ? "bg-primary text-on-primary"
                      : count > 0
                        ? "bg-primary-soft text-primary"
                        : "border border-dashed border-line",
                  )}
                >
                  {count > 0 ? count : ""}
                </span>
                {weekdayLetter(date)}
              </span>
            );
          })}
        </span>
      )}
      <span className="block mt-3 text-sm text-ink-muted tabular-nums">
        <span className="text-ink font-medium">{meals(mealCount(plan))}</span>
        {today && plan.averageKcal && ` · ${kcal(plan.averageKcal)} a day each`}
        {!today && emptyDays > 0 && ` · ${emptyDays === 1 ? "1 day" : `${emptyDays} days`} empty`}
      </span>
    </Link>
  );
}

function weekdayLetter(date: string) {
  return "SMTWTFS"[new Date(`${date}T00:00:00Z`).getUTCDay()];
}
