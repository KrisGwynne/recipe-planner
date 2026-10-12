import type { Metadata } from "next";
import { signOut } from "@/auth";
import { Page } from "@/components/page";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Household" };

// Placeholder until households (PP-154) and household settings (PP-157).
export default function HouseholdPage() {
  return (
    <Page title="Household">
      <div className="max-w-md">
        <EmptyState icon="users" title="Your household">
          Members, invites and settings will live here.
        </EmptyState>
        {/* Styled as on the create-household screen (onboarding design B). */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button type="submit" className="mt-2 w-full h-11 text-sm font-medium text-ink-muted">
            Sign out
          </button>
        </form>
      </div>
    </Page>
  );
}
