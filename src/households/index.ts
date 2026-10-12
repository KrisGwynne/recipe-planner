import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { householdMembers, households } from "@/db/schema";

export type Membership = {
  householdId: string;
  name: string;
  role: "owner" | "member";
};

/** The household `userId` belongs to (one at a time for now), or null. */
export async function getMembership(db: Db, userId: string): Promise<Membership | null> {
  const [row] = await db
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
 * Creates a household with `userId` as its owner. One statement, so the
 * household is never left without its owner. Throws AlreadyInHouseholdError
 * if they're already in one (the unique index on household_members.user_id
 * also catches two at once).
 */
export async function createHousehold(db: Db, userId: string, name: string): Promise<Membership> {
  const validName = householdName.parse(name);
  try {
    await db.execute(sql`
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
  const membership = await getMembership(db, userId);
  if (!membership) throw new Error("Household was created but the membership wasn't found");
  return membership;
}

// Postgres unique_violation, possibly wrapped by Drizzle (error.cause).
function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
