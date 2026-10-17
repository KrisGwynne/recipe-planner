import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/auth";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";
import { getDeparture, getMembership } from "@/data";
import { firstName } from "@/lib/format";
import { CreateHouseholdForm } from "./create-household-form";
import { DeleteAccount } from "./delete-account";

export const metadata: Metadata = { title: "Welcome" };

// Onboarding design B: for anyone signed in without a household (after first
// sign-in, or after leaving one). People with a household go to the app.
// After leaving, being removed or the household being deleted, a note says so
// (household design M), the same whichever it was. Sign out and Delete my
// account… share the bottom row (household design N, PP-183).
export default async function WelcomePage() {
  const user = await requireUser();
  if (await getMembership(user.id)) redirect("/recipes");
  const first = firstName(user.name);
  const left = await getDeparture(user.id);

  return (
    <main className="mx-auto max-w-md min-h-dvh flex flex-col">
      <CreateHouseholdForm>
        <Avatar name={user.name ?? user.email} image={user.image} />
        <h1 className="font-display text-[28px] leading-[34px] font-semibold mt-5">
          {first ? `Welcome, ${first}` : "Welcome"}
        </h1>
        <p className="mt-2 text-[17px] leading-[26px] text-ink-muted">
          Recipes and meal plans live in a household, so everyone you cook with sees the same things. Start one now; you
          can invite people next.
        </p>
        {left && (
          <p role="status" className="mt-5 rounded-control bg-surface-2 px-4 py-3 text-sm flex gap-3">
            <Icon name="alert" className="size-5 shrink-0 text-ink-muted" />
            <span>
              You&apos;re no longer in <b>{left}</b>. Start your own household, or open an invite link to join one.
            </span>
          </p>
        )}
      </CreateHouseholdForm>
      {/* Sign out and Delete my account… on one quiet row (household design N). */}
      <div className="mt-2 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] flex items-center justify-center text-sm font-medium text-ink-muted">
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button type="submit" className="h-11 px-3">
            Sign out
          </button>
        </form>
        <span aria-hidden="true" className="text-ink-subtle">
          ·
        </span>
        <DeleteAccount className="h-11 px-3" />
      </div>
    </main>
  );
}
