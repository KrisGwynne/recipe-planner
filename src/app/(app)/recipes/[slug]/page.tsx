import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RecipeView } from "@/components/recipe/recipe-view";
import { getRecipeBySlug, listPlans, requireHousehold } from "@/data";
import { defaultPlanName, defaultStartDate, plansToAddTo, today } from "@/plans/plan";
import { AddToPlan } from "./add-to-plan";
import { RecipeHeader } from "./recipe-header";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The recipe page (designs/src/recipe.html, PP-168). Found by the recipe's
// id within the household, so another household's id is a 404.
const findRecipe = cache(async (slug: string) => {
  const { ctx } = await requireHousehold();
  return getRecipeBySlug(ctx, slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await findRecipe((await params).slug);
  return { title: recipe?.name ?? "Recipe" };
}

/** ?servings=N from a planned meal (meal plans design F), 1 to 50 as on the page. */
function servingsParam(value: string | string[] | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : undefined;
}

export default async function RecipePage({ params, searchParams }: Props) {
  const { ctx } = await requireHousehold();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [row, plans] = await Promise.all([findRecipe(slug), listPlans(ctx)]);
  if (!row) notFound();
  const todayDate = today();
  const startDate = defaultStartDate(plans, todayDate);
  return (
    <main>
      <RecipeView
        recipe={row.data}
        header={<RecipeHeader recipe={row.data} />}
        initialServings={servingsParam(query.servings)}
      />
      <AddToPlan
        recipe={{ id: row.id, name: row.name, mealType: row.mealType, serves: row.serves }}
        plans={plansToAddTo(plans, todayDate).map(({ id, name, startDate, days }) => ({ id, name, startDate, days }))}
        newPlan={{ name: defaultPlanName(startDate), startDate, days: 7, people: 2 }}
        today={todayDate}
      />
    </main>
  );
}
