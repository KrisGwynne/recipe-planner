import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Page } from "@/components/page";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { listRecipes, requireHousehold } from "@/data";
import { toRecipeSummary } from "@/recipes/summary";
import { RecipeLibrary } from "./recipe-library";
import { VIEW_COOKIE, parseView } from "./view";

export const metadata: Metadata = { title: "Recipes" };

// The recipe library (designs/src/library.html, screens A, B and I).
export default async function RecipesPage() {
  const { ctx } = await requireHousehold();
  const [rows, cookieStore] = await Promise.all([listRecipes(ctx), cookies()]);

  if (rows.length === 0) {
    return (
      <Page title="Recipes">
        <EmptyLibrary />
      </Page>
    );
  }

  return (
    <Page
      title="Recipes"
      aside={<span className="tabular-nums">{rows.length === 1 ? "1 recipe" : `${rows.length} recipes`}</span>}
    >
      <RecipeLibrary recipes={rows.map(toRecipeSummary)} initialView={parseView(cookieStore.get(VIEW_COOKIE)?.value)} />
    </Page>
  );
}

// Screen I. "How do I make recipe JSON?" comes with the Claude project setup (PP-175).
function EmptyLibrary() {
  return (
    <div className="mx-auto max-w-sm px-3 pt-12 text-center">
      <span className="mx-auto size-16 rounded-full bg-primary-soft text-primary grid place-items-center">
        <Icon name="book" className="size-8" />
      </span>
      <p className="font-display text-[22px] font-semibold mt-5">Your recipe book is empty</p>
      <p className="text-ink-muted mt-2">
        Photograph a recipe, turn it into JSON in your Claude project, then import the file here.
      </p>
      <Link href="/import" className={buttonClasses("primary", "mt-6 w-full")}>
        <Icon name="upload" className="size-5" />
        Import recipes
      </Link>
    </div>
  );
}
