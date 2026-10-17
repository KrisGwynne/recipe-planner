import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { householdDepartures, householdMembers, households, users } from "@/db/schema";
import { requireOwner, type HouseholdContext, type Role } from "./context";
import { isUniqueViolation } from "./errors";

export type Membership = {
  householdId: string;
  name: string;
  role: Role;
};

/**
 * The household `userId` belongs to (one at a time for now), or null. Pass
 * only the signed-in user's id; for anything else use requireHousehold.
 */
export async function getMembership(userId: string): Promise<Membership | null> {
  const [row] = await getDb()
    .select({ householdId: households.id, name: households.name, role: householdMembers.role })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .limit(1);
  return row ?? null;
}

export const householdName = z
  .string()
  .trim()
  .min(1, "Enter a name for the household")
  .max(50, "Keep the name to 50 characters or fewer");

export class AlreadyInHouseholdError extends Error {
  constructor() {
    super("This user is already in a household");
  }
}

/**
 * Creates a household with `userId` (the signed-in user) as its owner. One
 * statement, so the household is never left without its owner. Throws
 * AlreadyInHouseholdError if they're already in one (the unique index on
 * household_members.user_id also catches two at once).
 */
export async function createHousehold(userId: string, name: string): Promise<Membership> {
  const validName = householdName.parse(name);
  try {
    await getDb().execute(sql`
      with new_household as (
        insert into ${households} ("name") values (${validName}) returning "id"
      )
      insert into ${householdMembers} ("household_id", "user_id", "role")
      select "id", ${userId}, 'owner' from new_household
    `);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AlreadyInHouseholdError();
    throw error;
  }
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Household was created but the membership wasn't found");
  return membership;
}

/** The user's own household. */
export async function getHousehold(ctx: HouseholdContext) {
  const [row] = await getDb()
    .select({ id: households.id, name: households.name, createdAt: households.createdAt })
    .from(households)
    .where(eq(households.id, ctx.householdId));
  if (!row) throw new Error("The household in this context no longer exists");
  return row;
}

/** Everyone in the user's household, owners first, then by when they joined. */
export async function listMembers(ctx: HouseholdContext) {
  return getDb()
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: householdMembers.role,
      joinedAt: householdMembers.joinedAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, ctx.householdId))
    .orderBy(asc(householdMembers.role), asc(householdMembers.joinedAt));
}

// Household settings (PP-157, designs/src/household.html). Each change is one
// statement (the Neon HTTP driver has no transactions), with the "always an
// owner" rule inside it. Two owners leaving at the same instant could still
// leave none; households are small enough to accept that (Kris, 2026-10-14).

function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

/** Records who's no longer in the household, for the note on /welcome (design M). */
const departures = (householdName: ReturnType<typeof sql>) => sql`
  insert into ${householdDepartures} ("user_id", "household_name")
  select "user_id", ${householdName} from gone
  on conflict ("user_id") do update set "household_name" = excluded."household_name", "left_at" = now()
  returning "user_id"
`;

/** How many recipes and meal plans the household has, for the leave and delete sheets. */
export async function householdCounts(ctx: HouseholdContext): Promise<{ recipes: number; plans: number }> {
  const [row] = rows<{ recipes: number; plans: number }>(
    await getDb().execute(sql`
      select (select count(*)::int from recipes where household_id = ${ctx.householdId}) as recipes,
             (select count(*)::int from meal_plans where household_id = ${ctx.householdId}) as plans
    `),
  );
  return row;
}

/** Renames the household. Owners only. */
export async function renameHousehold(ctx: HouseholdContext, name: string): Promise<string> {
  requireOwner(ctx);
  const validName = householdName.parse(name);
  await getDb().update(households).set({ name: validName }).where(eq(households.id, ctx.householdId));
  return validName;
}

/**
 * Makes another member an owner, or another owner a member (design F).
 * Owners only, and not yourself. False if they aren't in the household.
 */
export async function setRole(ctx: HouseholdContext, userId: string, role: Role): Promise<boolean> {
  requireOwner(ctx);
  const validRole = z.enum(["owner", "member"]).parse(role);
  if (userId === ctx.userId) return false;
  const updated = await getDb()
    .update(householdMembers)
    .set({ role: validRole })
    .where(sql`${householdMembers.householdId} = ${ctx.householdId} and ${householdMembers.userId} = ${userId}`)
    .returning({ userId: householdMembers.userId });
  return updated.length > 0;
}

/** Removes someone else from the household (design G). Owners only. False if they aren't in it. */
export async function removeMember(ctx: HouseholdContext, userId: string): Promise<boolean> {
  requireOwner(ctx);
  if (userId === ctx.userId) return false;
  const result = await getDb().execute(sql`
    with gone as (
      delete from ${householdMembers}
      where "household_id" = ${ctx.householdId} and "user_id" = ${userId}
      returning "user_id"
    )
    ${departures(sql`(select "name" from ${households} where "id" = ${ctx.householdId})`)}
  `);
  return rows(result).length > 0;
}

/**
 * Leaves the household (design H). A member can always leave; an owner only
 * while another owner stays. False for the last owner (design I).
 */
export async function leaveHousehold(ctx: HouseholdContext): Promise<boolean> {
  const result = await getDb().execute(sql`
    with gone as (
      delete from ${householdMembers} m
      where m."household_id" = ${ctx.householdId} and m."user_id" = ${ctx.userId}
        and (m."role" = 'member' or exists (
          select 1 from ${householdMembers} o
          where o."household_id" = m."household_id" and o."role" = 'owner' and o."user_id" <> m."user_id"
        ))
      returning m."user_id"
    )
    ${departures(sql`(select "name" from ${households} where "id" = ${ctx.householdId})`)}
  `);
  return rows(result).length > 0;
}

/**
 * Deletes the household, with its recipes, plans, recipe data and invites,
 * for everyone (design J). Owners only, and only when `confirmName` matches
 * its name (ignoring case and spaces at the ends). False if it doesn't.
 */
export async function deleteHousehold(ctx: HouseholdContext, confirmName: string): Promise<boolean> {
  requireOwner(ctx);
  const result = await getDb().execute(sql`
    with deleted as (
      delete from ${households}
      where "id" = ${ctx.householdId} and lower(trim("name")) = lower(trim(${confirmName}))
      returning "name"
    ),
    gone as (
      select "user_id" from ${householdMembers} where "household_id" = ${ctx.householdId} and exists (select 1 from deleted)
    )
    ${departures(sql`(select "name" from deleted)`)}
  `);
  return rows(result).length > 0;
}

/**
 * Deletes the signed-in user's account (PP-158, designs K and L): the user row,
 * and through its cascades their Google link, sessions, membership and the
 * invite links they made. What they added stays, no longer saying who. Signing
 * in again starts from scratch.
 *
 * A member, or an owner while another owner stays, just goes. The only person
 * in the household takes it with them, and only when `confirmName` matches its
 * name (as deleteHousehold). The only owner with others in it can't: false.
 */
export async function deleteAccount(ctx: HouseholdContext, confirmName = ""): Promise<boolean> {
  const result = await getDb().execute(sql`
    with me as (
      select "role" from ${householdMembers} where "household_id" = ${ctx.householdId} and "user_id" = ${ctx.userId}
    ),
    others as (
      select count(*)::int as "people", (count(*) filter (where "role" = 'owner'))::int as "owners"
      from ${householdMembers} where "household_id" = ${ctx.householdId} and "user_id" <> ${ctx.userId}
    ),
    deleted_household as (
      delete from ${households}
      where "id" = ${ctx.householdId} and exists (select 1 from me) and (select "people" from others) = 0
        and lower(trim("name")) = lower(trim(${confirmName}))
      returning "id"
    ),
    deleted_user as (
      delete from ${users}
      where "id" = ${ctx.userId} and exists (select 1 from me) and (
        exists (select 1 from deleted_household)
        or ((select "people" from others) > 0 and ((select "role" from me) = 'member' or (select "owners" from others) > 0))
      )
      returning "id"
    )
    select "id" from deleted_user
  `);
  return rows(result).length > 0;
}

/** The household the signed-in user last left (for /welcome's note), or null. */
export async function getDeparture(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ householdName: householdDepartures.householdName })
    .from(householdDepartures)
    .where(eq(householdDepartures.userId, userId));
  return row?.householdName ?? null;
}
