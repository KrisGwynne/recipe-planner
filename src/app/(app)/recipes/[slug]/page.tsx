import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RecipeView } from "@/components/recipe/recipe-view";
import { categoryOf } from "@/components/ui/badge";
import { getRecipeBySlug, getRecipeHousehold, listPlans, recipePlanUses, requireHousehold } from "@/data";
import { defaultPlanName, defaultStartDate, mealName, plansToAddTo, today } from "@/plans/plan";
import { browsingCategory } from "@/recipes/derive";
import type { DietaryFlag } from "@/types/recipe";
import { AddToPlan } from "./add-to-plan";
import { CookedTodayButton, HouseholdSummary, OurNotes, RecipeHousehold } from "./household";
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
  const { ctx, user } = await requireHousehold();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [row, plans] = await Promise.all([findRecipe(slug), listPlans(ctx)]);
  if (!row) notFound();
  const [household, uses] = await Promise.all([getRecipeHousehold(ctx, row.id), recipePlanUses(ctx, row.id)]);
  if (!household) notFound();
  const todayDate = today();
  const startDate = defaultStartDate(plans, todayDate);
  return (
    <main>
      <RecipeHousehold recipeId={row.id} initial={household} today={todayDate} me={user.name ?? null}>
        <RecipeView
          recipe={row.data}
          header={
            <RecipeHeader
              recipe={row.data}
              recipeId={row.id}
              plans={uses.map((use) => ({ name: use.name, meals: use.meals.map((m) => mealName(use, m.dayIndex, m.slot)) }))}
              freezer={{
                id: row.id,
                name: row.name,
                serves: row.serves,
                category: categoryOf(browsingCategory(row.proteinType, row.dietary as DietaryFlag[])),
              }}
              today={todayDate}
            />
          }
          initialServings={servingsParam(query.servings)}
          household={<HouseholdSummary />}
          notes={<OurNotes />}
        />
        <AddToPlan
          recipe={{ id: row.id, name: row.name, mealType: row.mealType, serves: row.serves }}
          plans={plansToAddTo(plans, todayDate).map(({ id, name, startDate, days }) => ({ id, name, startDate, days }))}
          newPlan={{ name: defaultPlanName(startDate), startDate, days: 7, people: 2 }}
          today={todayDate}
        >
          <CookedTodayButton />
        </AddToPlan>
      </RecipeHousehold>
    </main>
  );
}
