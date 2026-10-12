// Two households for isolation tests (PP-155). Every household table's tests
// use this: act as household A and try to reach B's rows by id.
//
//   const db = await createTestDb();  vi.mock("@/db", () => ({ getDb: () => db }))
//   const { a, aMember, b } = await twoHouseholds(db);
import type { Db } from "@/db";
import { householdMembers, households, users } from "@/db/schema";
import { contextFor, type HouseholdContext } from "./context";

export type TwoHouseholds = {
  /** Owner of household A ("kris"). */
  a: HouseholdContext;
  /** A member (not owner) of household A ("sam"). */
  aMember: HouseholdContext;
  /** Owner of household B ("alex"). */
  b: HouseholdContext;
};

export async function twoHouseholds(db: Db): Promise<TwoHouseholds> {
  await db.insert(users).values([
    { id: "kris", name: "Kris", email: "kris@example.com" },
    { id: "sam", name: "Sam", email: "sam@example.com" },
    { id: "alex", name: "Alex", email: "alex@example.com" },
  ]);
  const [householdA, householdB] = await db
    .insert(households)
    .values([{ name: "Household A" }, { name: "Household B" }])
    .returning({ id: households.id });
  await db.insert(householdMembers).values([
    { householdId: householdA.id, userId: "kris", role: "owner" },
    { householdId: householdA.id, userId: "sam", role: "member" },
    { householdId: householdB.id, userId: "alex", role: "owner" },
  ]);
  return {
    a: contextFor({ userId: "kris", householdId: householdA.id, role: "owner" }),
    aMember: contextFor({ userId: "sam", householdId: householdA.id, role: "member" }),
    b: contextFor({ userId: "alex", householdId: householdB.id, role: "owner" }),
  };
}
