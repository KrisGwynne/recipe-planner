import type { Metadata } from "next";
import { signOut } from "@/auth";
import { Avatar } from "@/components/avatar";
import { Page } from "@/components/page";
import { householdCounts, listInvites, listMembers, requireHousehold } from "@/data";
import { HouseholdSettings, type Member } from "./household-settings";

export const metadata: Metadata = { title: "Household" };

// Household settings and account (designs/src/household.html, PP-157). Owners
// see everything; members see the household and their own account (design C).
// "Download all recipes" comes with PP-164 and "Delete my account" with
// PP-158 (Kris, 2026-10-14).
export default async function HouseholdPage() {
  const { user, household, ctx } = await requireHousehold();
  const owner = household.role === "owner";
  const [members, invites, counts] = await Promise.all([
    listMembers(ctx),
    owner ? listInvites(ctx) : Promise.resolve([]),
    householdCounts(ctx),
  ]);

  return (
    <Page title="Household">
      <HouseholdSettings
        household={{ name: household.name, role: household.role, ...counts }}
        me={user.id}
        members={members.map(
          (m): Member => ({ userId: m.userId, name: m.name, email: m.email, image: m.image, role: m.role, joinedAt: m.joinedAt }),
        )}
        invites={invites.map((i) => ({
          id: i.id,
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
          createdBy: i.createdById === user.id ? null : (i.createdBy ?? ""),
        }))}
        account={
          <div className="rounded-card bg-surface border border-line divide-y divide-line">
            <div className="flex items-center gap-3 px-4 py-3">
              <Avatar name={user.name ?? user.email} image={user.image} size={40} className="shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{user.name ?? user.email}</span>
                <span className="block text-sm text-ink-muted truncate">Signed in with Google as {user.email}</span>
              </span>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button type="submit" className="w-full h-13 px-4 flex items-center font-semibold text-left hover:bg-surface-2 rounded-b-card">
                Sign out
              </button>
            </form>
          </div>
        }
      />
    </Page>
  );
}
