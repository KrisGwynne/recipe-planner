import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { INVITE_DAYS, requireHousehold } from "@/data";
import { createInviteAction } from "./actions";
import { InviteLink } from "./invite-link";

export const metadata: Metadata = { title: "Invite someone" };

// Onboarding design C: straight after creating a household, an optional step
// to invite the people you cook with. Only owners can invite.
export default async function InviteStepPage() {
  const { household } = await requireHousehold();
  if (household.role !== "owner") redirect("/recipes");

  return (
    <main className="mx-auto max-w-md min-h-dvh flex flex-col">
      <div className="flex-1 px-6 pt-14">
        <span className="size-14 rounded-full bg-veg-soft text-veg grid place-items-center">
          <Icon name="check" className="size-7" strokeWidth={2.5} />
        </span>
        <h1 className="font-display text-[28px] leading-[34px] font-semibold mt-5">{household.name} is ready</h1>
        <p className="mt-2 text-[17px] leading-[26px] text-ink-muted">
          Invite the people you cook with. They&apos;ll need a Google account.
        </p>
        <div className="mt-6 rounded-card bg-surface border border-line p-4">
          <InviteLink createLink={createInviteAction} householdName={household.name} />
          <p className="mt-3 text-xs text-ink-subtle">Works once, for one person, and expires in {INVITE_DAYS} days.</p>
        </div>
      </div>
      <div className="px-6 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <Link href="/recipes" className={buttonClasses("primary", "w-full")}>
          Done, go to recipes
        </Link>
        <Link href="/recipes" className="mt-2 w-full h-11 text-sm font-medium text-ink-muted grid place-items-center">
          Skip for now
        </Link>
      </div>
    </main>
  );
}
