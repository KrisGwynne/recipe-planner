import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { requireUser } from "@/auth";
import { contextFor } from "./context";
import { getMembership } from "./households";

/**
 * The signed-in user, their household, and the context every household query
 * takes. Without a session: sign-in. Without a household: the create-household
 * step (/welcome). Cached per request, so a layout and its page share one
 * lookup.
 */
export const requireHousehold = cache(async () => {
  const user = await requireUser();
  const household = await getMembership(user.id);
  if (!household) redirect("/welcome");
  return { user, household, ctx: contextFor({ userId: user.id, ...household }) };
});
