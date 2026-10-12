import { redirect } from "next/navigation";
import { cache } from "react";
import { requireUser } from "@/auth";
import { getDb } from "@/db";
import { getMembership } from "./index";

/**
 * The signed-in user and their household. Without a session: sign-in.
 * Without a household: the create-household step (/welcome). Cached per
 * request, so a layout and its page share one lookup.
 */
export const requireHousehold = cache(async () => {
  const user = await requireUser();
  const household = await getMembership(getDb(), user.id);
  if (!household) redirect("/welcome");
  return { user, household };
});
