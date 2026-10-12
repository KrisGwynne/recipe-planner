import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/page";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Recipes" };

// Placeholder until the list view (PP-166).
export default function RecipesPage() {
  return (
    <Page title="Recipes">
      <div className="max-w-md">
        <EmptyState
          icon="book"
          title="No recipes yet"
          action={
            <Link href="/import" className={buttonClasses("primary")}>
              <Icon name="upload" className="size-5" />
              Import recipes
            </Link>
          }
        >
          Turn a photo into recipe JSON in Claude, then import it here.
        </EmptyState>
      </div>
    </Page>
  );
}
