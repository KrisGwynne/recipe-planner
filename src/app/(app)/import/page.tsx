import type { Metadata } from "next";
import { Page } from "@/components/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Import" };

// Placeholder until the import screen (PP-162).
export default function ImportPage() {
  return (
    <Page title="Import">
      <div className="max-w-md">
        <EmptyState icon="upload" title="Import recipes">
          Turn a photo into recipe JSON in Claude, then import it here.
        </EmptyState>
      </div>
    </Page>
  );
}
