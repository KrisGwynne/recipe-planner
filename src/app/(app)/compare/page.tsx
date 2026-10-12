import type { Metadata } from "next";
import { Page } from "@/components/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Compare" };

// Placeholder until the compare epic.
export default function ComparePage() {
  return (
    <Page title="Compare">
      <div className="max-w-md">
        <EmptyState icon="chart" title="Nothing to compare yet">
          Compare recipes side by side on time and nutrition.
        </EmptyState>
      </div>
    </Page>
  );
}
