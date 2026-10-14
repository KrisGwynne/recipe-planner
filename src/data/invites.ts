import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { householdInvites, householdMembers, households, users } from "@/db/schema";
import { requireOwner, type HouseholdContext } from "./context";
import { isUniqueViolation } from "./errors";
import { getMembership } from "./households";

// Invite links (PP-156, handover section 3): owners make them; anyone holding
// one can see who it's from and join. Links work once and last 7 days. The
// token is the only secret: it's in the link, and only its hash is stored.

export const INVITE_DAYS = 7;

/** SHA-256 of a token, as stored in household_invites.token_hash. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A new link for the owner's household. The token can't be read back later. */
export async function createInvite(ctx: HouseholdContext): Promise<{ token: string; expiresAt: Date }> {
  requireOwner(ctx);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  await getDb().insert(householdInvites).values({
    householdId: ctx.householdId,
    tokenHash: hashToken(token),
    createdBy: ctx.userId,
    expiresAt,
  });
  return { token, expiresAt };
}

/** The household's links that can still be used, newest first. Owners only. */
export async function listInvites(ctx: HouseholdContext) {
  requireOwner(ctx);
  return getDb()
    .select({
      id: householdInvites.id,
      createdAt: householdInvites.createdAt,
      expiresAt: householdInvites.expiresAt,
      createdBy: users.name,
      createdById: householdInvites.createdBy,
    })
    .from(householdInvites)
    .innerJoin(users, eq(users.id, householdInvites.createdBy))
    .where(
      and(
        eq(householdInvites.householdId, ctx.householdId),
        isNull(householdInvites.usedAt),
        isNull(householdInvites.revokedAt),
        gt(householdInvites.expiresAt, sql`now()`),
      ),
    )
    .orderBy(desc(householdInvites.createdAt));
}

/**
 * Turns off one of the household's unused links. False if there's no such
 * link in this household (another household's id finds nothing) or it's
 * already used or revoked. Owners only.
 */
export async function revokeInvite(ctx: HouseholdContext, inviteId: string): Promise<boolean> {
  requireOwner(ctx);
  if (!z.uuid().safeParse(inviteId).success) return false;
  const revoked = await getDb()
    .update(householdInvites)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(householdInvites.id, inviteId),
        eq(householdInvites.householdId, ctx.householdId),
        isNull(householdInvites.usedAt),
        isNull(householdInvites.revokedAt),
      ),
    )
    .returning({ id: householdInvites.id });
  return revoked.length > 0;
}

export type InviteStatus = "open" | "expired" | "used" | "revoked";

/** Where the person looking at an invite stands. */
export type Invitee =
  | { kind: "signed-out" }
  | { kind: "no-household" }
  | { kind: "member" }
  | { kind: "other-household"; householdName: string };

/**
 * What an invite page may show (onboarding design D–F): the inviter's name
 * and photo and the household name, nothing else about the household, to
 * anyone holding the link. Null for a link that doesn't exist.
 */
export type InvitePreview = {
  status: InviteStatus;
  householdName: string;
  inviter: { name: string | null; image: string | null };
  you: Invitee;
};

/** The invite behind `token`, as seen by `userId` (the signed-in user, or null). */
export async function getInvite(token: string, userId: string | null): Promise<InvitePreview | null> {
  const [invite] = await getDb()
    .select({
      householdId: householdInvites.householdId,
      householdName: households.name,
      inviterName: users.name,
      inviterImage: users.image,
      used: sql<boolean>`${householdInvites.usedAt} is not null`,
      revoked: sql<boolean>`${householdInvites.revokedAt} is not null`,
      expired: sql<boolean>`${householdInvites.expiresAt} <= now()`,
    })
    .from(householdInvites)
    .innerJoin(households, eq(households.id, householdInvites.householdId))
    .innerJoin(users, eq(users.id, householdInvites.createdBy))
    .where(eq(householdInvites.tokenHash, hashToken(token)));
  if (!invite) return null;

  return {
    status: invite.used ? "used" : invite.revoked ? "revoked" : invite.expired ? "expired" : "open",
    householdName: invite.householdName,
    inviter: { name: invite.inviterName, image: invite.inviterImage },
    you: await invitee(userId, invite.householdId),
  };
}

async function invitee(userId: string | null, householdId: string): Promise<Invitee> {
  if (!userId) return { kind: "signed-out" };
  const membership = await getMembership(userId);
  if (!membership) return { kind: "no-household" };
  if (membership.householdId === householdId) return { kind: "member" };
  return { kind: "other-household", householdName: membership.name };
}

export type AcceptResult =
  | { joined: true }
  | { joined: false; reason: "invalid" | "member" | "other-household" | Exclude<InviteStatus, "open"> };

/**
 * Joins `userId` (the signed-in user) to the invite's household as a member.
 * One statement uses up the link and adds the member, so a link can't let two
 * people in, and someone already in a household doesn't use it up.
 */
export async function acceptInvite(userId: string, token: string): Promise<AcceptResult> {
  const before = await getInvite(token, userId);
  if (!before) return { joined: false, reason: "invalid" };
  if (before.you.kind === "member" || before.you.kind === "other-household") {
    return { joined: false, reason: before.you.kind };
  }

  try {
    await getDb().execute(sql`
      with claimed as (
        update ${householdInvites} set "used_at" = now(), "used_by" = ${userId}
        where "token_hash" = ${hashToken(token)}
          and "used_at" is null and "revoked_at" is null and "expires_at" > now()
        returning "household_id"
      )
      insert into ${householdMembers} ("household_id", "user_id", "role")
      select "household_id", ${userId}, 'member' from claimed
    `);
  } catch (error) {
    // Joined a household in the meantime (another tab): the unique index
    // refuses the member, and the whole statement, link included, is undone.
    if (!isUniqueViolation(error)) throw error;
  }

  // Joined, or why not: the link was used, revoked or expired before we got
  // to it, or the user joined somewhere else.
  const after = await getInvite(token, userId);
  if (!after) return { joined: false, reason: "invalid" };
  if (after.you.kind === "member") return { joined: true };
  if (after.you.kind === "other-household") return { joined: false, reason: after.you.kind };
  if (after.status === "open") throw new Error("Invite is open but joining failed");
  return { joined: false, reason: after.status };
}
