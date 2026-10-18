import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { categoryOf } from "@/components/ui/badge";
import { listFreezer, listPlans, listRecipes, requireHousehold } from "@/data";
import { freezerSummary } from "@/plans/freezer";
import { plansToAddTo, today } from "@/plans/plan";
import { browsingCategory } from "@/recipes/derive";
import type { DietaryFlag } from "@/types/recipe";
import { FreezerView } from "./freezer-view";

export const metadata: Metadata = { title: "Freezer" };

// The household's freezer (designs/src/leftovers.html H to K; PP-189).
export default async function FreezerPage() {
  const { ctx } = await requireHousehold();
  const todayDate = today();
  const [items, recipes, plans] = await Promise.all([listFreezer(ctx, todayDate), listRecipes(ctx), listPlans(ctx)]);
  const summary = freezerSummary(items);

  return (
    <main className="mx-auto max-w-3xl pb-28">
      <div className="px-3 pt-3 flex items-center gap-1 md:pt-6">
        <Link
          href="/plans"
          aria-label="Back to plans"
          className="size-11 shrink-0 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Icon name="arrow-left" className="size-6" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[22px] leading-7 font-semibold">Freezer</h1>
          {summary.in > 0 && <p className="text-sm text-ink-muted">{summary.text}</p>}
        </div>
      </div>
      <FreezerView
        items={items}
        today={todayDate}
        plans={plansToAddTo(plans, todayDate).map(({ id, name, startDate, days }) => ({ id, name, startDate, days }))}
        recipes={recipes.map((r) => ({
          id: r.id,
          name: r.name,
          serves: r.serves,
          category: categoryOf(browsingCategory(r.proteinType, r.dietary as DietaryFlag[])),
        }))}
      />
    </main>
  );
}
