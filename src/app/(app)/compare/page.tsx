import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/page";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { getRecipesBySlugs, listRecipes, requireHousehold } from "@/data";
import { MIN_RECIPES, choseInAddress, chooseHref, paramsOf, parseChosen } from "@/compare/compare";
import { Chosen, CompareView, type Compared } from "./compare-view";
import { RememberComparison, RestoreComparison } from "./remember";

export const metadata: Metadata = { title: "Compare" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Compare 2 to 4 recipes (designs/src/compare.html, PP-173):
 * /compare?r=<slug>&r=<slug>. Slugs are looked up within the household, so
 * another household's recipe, or a deleted one, just drops out (design H).
 * The bare tab goes back to the last comparison on this device.
 */
export default async function ComparePage({ searchParams }: Props) {
  const { ctx } = await requireHousehold();
  const params = paramsOf(await searchParams);
  const slugs = parseChosen(params);
  const rows = await getRecipesBySlugs(ctx, slugs);
  const compared: Compared[] = slugs.flatMap((slug) => {
    const row = rows.find((r) => r.slug === slug);
    return row ? [{ slug, recipe: row.data }] : [];
  });
  const found = compared.map((c) => c.slug);

  if (compared.length >= MIN_RECIPES) {
    return (
      <Page title="Compare">
        <RememberComparison slugs={found} />
        <p className="-mt-3 mb-4 text-sm text-ink-muted">Per serving, as each recipe gives it.</p>
        <CompareView compared={compared} />
      </Page>
    );
  }

  const libraryCount = (await listRecipes(ctx)).length;
  const empty = (
    <Page title="Compare">
      <div className="max-w-md">
        {compared.length === 1 ? (
          // Design H: one left, nothing to compare it with.
          <div className="space-y-4">
            <Chosen compared={compared} />
            <p className="text-ink-muted">Add at least one more recipe to compare.</p>
          </div>
        ) : libraryCount < MIN_RECIPES ? (
          <NotEnoughRecipes count={libraryCount} />
        ) : (
          <Start />
        )}
      </div>
    </Page>
  );

  return choseInAddress(params) ? (
    <>
      <RememberComparison slugs={found} />
      {empty}
    </>
  ) : (
    <RestoreComparison>{empty}</RestoreComparison>
  );
}

/** Design A: nothing chosen yet. */
function Start() {
  return (
    <div className="pt-6 text-center">
      <span className="mx-auto size-16 rounded-full bg-primary-soft text-primary grid place-items-center">
        <Icon name="chart" className="size-8" />
      </span>
      <h2 className="mt-4 font-display text-[22px] leading-7 font-semibold">See recipes side by side</h2>
      <p className="mt-2 text-ink-muted">
        Pick 2 to 4 recipes to compare their calories, protein, carbs and fat per serving, with times and dietary details in
        a table.
      </p>
      <Link href={chooseHref([])} className={buttonClasses("primary", "mt-6 px-6")}>
        Choose recipes
      </Link>
      <p className="mt-4 text-sm text-ink-muted">
        Or open a recipe and choose <b className="text-ink font-medium">Compare with…</b> from its ⋯ menu.
      </p>
    </div>
  );
}

/** Design H: fewer than two recipes in the library. */
function NotEnoughRecipes({ count }: { count: number }) {
  return (
    <div className="rounded-card bg-surface border border-line p-5">
      <h2 className="font-display text-xl font-semibold">Import at least two recipes to compare them</h2>
      <p className="mt-1 text-ink-muted">{count === 0 ? "You don't have any yet." : "You have 1 so far."}</p>
      <Link href="/import" className={buttonClasses("secondary", "mt-4")}>
        <Icon name="upload" className="size-5" />
        Import recipes
      </Link>
    </div>
  );
}
