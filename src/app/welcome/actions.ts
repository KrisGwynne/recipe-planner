"use server";

import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/auth";
import { AlreadyInHouseholdError, createHousehold, deleteAccountWithoutHousehold, householdName } from "@/data";

export type CreateHouseholdState = { name: string; error?: string };

/** Creates the user's household, then offers an invite link (screen C). */
export async function createHouseholdAction(
  _previous: CreateHouseholdState,
  formData: FormData,
): Promise<CreateHouseholdState> {
  const user = await requireUser();
  const raw = String(formData.get("name") ?? "");
  const parsed = householdName.safeParse(raw);
  if (!parsed.success) return { name: raw, error: parsed.error.issues[0].message };

  try {
    await createHousehold(user.id, parsed.data);
  } catch (error) {
    // Already in one (another tab, or a double tap): carry on into the app.
    if (!(error instanceof AlreadyInHouseholdError)) throw error;
    redirect("/recipes");
  }
  redirect("/welcome/invite");
}

/**
 * Delete my account from "Start a household" (household designs N and O), then
 * sign out to the sign-in page's note (design M). False if they're in a
 * household after all (another tab): that goes through the Household tab.
 */
export async function deleteAccountAction(): Promise<boolean> {
  const user = await requireUser();
  if (!(await deleteAccountWithoutHousehold(user.id))) return false;
  // The session row went with the account; this clears the cookie.
  await signOut({ redirectTo: "/sign-in?deleted=1" });
  return true;
}
