import type { Metadata } from "next";
import { Page } from "@/components/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Household" };

// Placeholder until households (PP-154).
export default function HouseholdPage() {
  return (
    <Page title="Household">
      <div className="max-w-md">
        <EmptyState icon="users" title="Your household">
          Members, invites and settings will live here.
        </EmptyState>
      </div>
    </Page>
  );
}
