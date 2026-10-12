import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { householdMembers, households, users } from "@/db/schema";
import type { HouseholdContext, Role } from "./context";

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

// Postgres unique_violation, possibly wrapped by Drizzle (error.cause).
function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
