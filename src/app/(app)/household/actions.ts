"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import {
  deleteAccount,
  deleteHousehold,
  householdName,
  leaveHousehold,
  removeMember,
  renameHousehold,
  requireHousehold,
  revokeInvite,
  setRole,
  type Role,
} from "@/data";

// Household settings (PP-157, designs/src/household.html). The data layer
// checks the role and keeps every change inside the signed-in household;
// anything refused comes back as false rather than an error page.

async function attempt(change: () => Promise<boolean>): Promise<boolean> {
  try {
    if (!(await change())) return false;
  } catch {
    return false;
  }
  revalidatePath("/household");
  return true;
}

export type RenameState = { error?: string; saved?: boolean };

/** Rename (design D). */
export async function renameAction(_previous: RenameState, formData: FormData): Promise<RenameState> {
  const { ctx } = await requireHousehold();
  const parsed = householdName.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await renameHousehold(ctx, parsed.data);
  } catch {
    return { error: "Couldn't rename the household. Try again." };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}

/** Make an owner, or a member (design F). */
export async function setRoleAction(userId: string, role: Role): Promise<boolean> {
  const { ctx } = await requireHousehold();
  return attempt(() => setRole(ctx, userId, role));
}

/** Remove someone (design G). */
export async function removeMemberAction(userId: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  return attempt(() => removeMember(ctx, userId));
}

/** Cancel an open invite link (design A). */
export async function revokeInviteAction(inviteId: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  return attempt(() => revokeInvite(ctx, inviteId));
}

/** Leave (design H), then "Start a household". False for the last owner (design I). */
export async function leaveAction(): Promise<boolean> {
  const { ctx } = await requireHousehold();
  if (!(await attempt(() => leaveHousehold(ctx)))) return false;
  redirect("/welcome");
}

/** Delete the household (design J), then "Start a household". False if the name doesn't match. */
export async function deleteHouseholdAction(confirmName: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  if (!(await attempt(() => deleteHousehold(ctx, confirmName)))) return false;
  redirect("/welcome");
}

/**
 * Delete my account (designs K and L), then sign out to the sign-in page's
 * note (design M). `confirmName` is only needed when the household goes too.
 * False for the only owner with others in the household, or a wrong name.
 */
export async function deleteAccountAction(confirmName?: string): Promise<boolean> {
  const { ctx } = await requireHousehold();
  if (!(await attempt(() => deleteAccount(ctx, confirmName)))) return false;
  // The session row went with the account; this clears the cookie.
  await signOut({ redirectTo: "/sign-in?deleted=1" });
  return true;
}
