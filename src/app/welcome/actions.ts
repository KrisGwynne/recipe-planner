"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { AlreadyInHouseholdError, createHousehold, householdName } from "@/data";

export type CreateHouseholdState = { name: string; error?: string };

/** Creates the user's household, then opens the (empty) library. */
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
  }
  redirect("/recipes");
}
