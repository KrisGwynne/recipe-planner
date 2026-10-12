"use server";

import { createInvite, requireHousehold } from "@/data";

/** A new invite link's path (/invite/<token>) for the owner's household. */
export async function createInviteAction(): Promise<string> {
  const { ctx } = await requireHousehold();
  const { token } = await createInvite(ctx);
  return `/invite/${token}`;
}
