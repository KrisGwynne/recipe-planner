import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Page } from "@/components/page";
import { Icon } from "@/components/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { getRecipeBySlug, requireHousehold } from "@/data";

type Props = { params: Promise<{ slug: string }> };

// Placeholder until the recipe page (PP-168), so the library's cards lead
// somewhere. Another household's slug finds nothing, so it's a 404.
const findRecipe = cache(async (slug: string) => {
  const { ctx } = await requireHousehold();
  return getRecipeBySlug(ctx, slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await findRecipe((await params).slug);
  return { title: recipe?.name ?? "Recipe" };
}

export default async function RecipePage({ params }: Props) {
  const recipe = await findRecipe((await params).slug);
  if (!recipe) notFound();
  return (
    <Page title={recipe.name}>
      <div className="max-w-md">
        <EmptyState
          icon="book"
          title="Recipe page coming soon"
          action={
            <Link href="/recipes" className="inline-flex items-center gap-1.5 h-11 font-semibold text-primary">
              <Icon name="arrow-left" className="size-5" />
              Back to recipes
            </Link>
          }
        >
          Ingredients, method and nutrition will show here.
        </EmptyState>
      </div>
    </Page>
  );
}
