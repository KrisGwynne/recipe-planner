"use server";

import { redirect } from "next/navigation";
import { requireUser, signIn, signOut } from "@/auth";
import { acceptInvite } from "@/data";

/** Joins the signed-in user to the invite's household (screen E's button). */
export async function joinAction(token: string) {
  const user = await requireUser();
  const result = await acceptInvite(user.id, token);
  // If it can't be used, the invite page explains why (screen F).
  redirect(result.joined ? "/recipes" : `/invite/${token}`);
}

/** "Not you?": sign out, then back in with Google's account chooser. */
export async function notYouAction(token: string) {
  await signOut({ redirect: false });
  await signIn("google", { redirectTo: `/invite/${token}` }, { prompt: "select_account" });
}
