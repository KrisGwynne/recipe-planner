import type { Metadata } from "next";
import { listRecipes, requireHousehold } from "@/data";
import { paramsOf, parseChosen } from "@/compare/compare";
import { ComparePicker } from "./compare-picker";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = { title: "Choose recipes to compare" };

/**
 * Choosing 2 to 4 recipes (compare design B, I): /compare/choose?r=<slug>,
 * starting with those ticked; the recipe page's "Compare with…" ticks itself.
 * Only the household's own recipes can be ticked.
 */
export default async function ChooseRecipesPage({ searchParams }: Props) {
  const { ctx } = await requireHousehold();
  const [recipes, query] = await Promise.all([listRecipes(ctx), searchParams]);
  const slugs = new Set(recipes.map((r) => r.slug));
  const initial = parseChosen(paramsOf(query)).filter((slug) => slugs.has(slug));
  return <ComparePicker recipes={recipes} initial={initial} />;
}
