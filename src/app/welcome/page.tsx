import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/auth";
import { Avatar } from "@/components/avatar";
import { getDb } from "@/db";
import { getMembership } from "@/households";
import { CreateHouseholdForm } from "./create-household-form";

export const metadata: Metadata = { title: "Welcome" };

/** "Kris" from "Kris Gwynne"; nothing if Google gave no name. */
function firstName(name: string | null | undefined): string | undefined {
  return name?.trim().split(/\s+/)[0] || undefined;
}

// Onboarding design B: for anyone signed in without a household (after first
// sign-in, or after leaving one). People with a household go to the app.
export default async function WelcomePage() {
  const user = await requireUser();
  if (await getMembership(getDb(), user.id)) redirect("/recipes");
  const first = firstName(user.name);

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
      </CreateHouseholdForm>
      <form
        className="px-6 pb-[max(2rem,env(safe-area-inset-bottom))]"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button type="submit" className="mt-2 w-full h-11 text-sm font-medium text-ink-muted">
          Sign out
        </button>
      </form>
    </main>
  );
}
