import type { Metadata } from "next";
import { Page } from "@/components/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Meal plans" };

// Placeholder until the meal plans epic.
export default function PlansPage() {
  return (
    <Page title="Meal plans">
      <div className="max-w-md">
        <EmptyState icon="calendar" title="No meal plans yet">
          Plan the week&apos;s meals and see the totals.
        </EmptyState>
      </div>
    </Page>
  );
}
