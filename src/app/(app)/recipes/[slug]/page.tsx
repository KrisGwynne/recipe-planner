import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RecipeView } from "@/components/recipe/recipe-view";
import { getRecipeBySlug, requireHousehold } from "@/data";
import { RecipeHeader } from "./recipe-header";

type Props = { params: Promise<{ slug: string }> };

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

export default async function RecipePage({ params }: Props) {
  const row = await findRecipe((await params).slug);
  if (!row) notFound();
  return (
    <main>
      <RecipeView recipe={row.data} header={<RecipeHeader recipe={row.data} />} />
    </main>
  );
}
