import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { householdMembers, households, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { AlreadyInHouseholdError, createHousehold, getMembership, householdName } from "./index";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "kris", name: "Kris", email: "kris@example.com" },
    { id: "alex", name: "Alex", email: "alex@example.com" },
  ]);
});

describe("createHousehold", () => {
  it("makes the user its owner", async () => {
    const membership = await createHousehold(db, "kris", "  Our kitchen ");
    expect(membership).toMatchObject({ name: "Our kitchen", role: "owner" });
    expect(await getMembership(db, "kris")).toEqual(membership);
  });

  it("refuses a second household, leaving nothing behind", async () => {
    await createHousehold(db, "kris", "Our kitchen");
    await expect(createHousehold(db, "kris", "Another")).rejects.toBeInstanceOf(AlreadyInHouseholdError);
    expect(await db.select().from(households)).toHaveLength(1);
    expect(await db.select().from(householdMembers)).toHaveLength(1);
  });

  it("refuses two created at once", async () => {
    const results = await Promise.allSettled([createHousehold(db, "kris", "One"), createHousehold(db, "kris", "Two")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(households)).toHaveLength(1);
  });

  it("refuses an invalid name", async () => {
    await expect(createHousehold(db, "kris", "   ")).rejects.toThrow("Enter a name for the household");
    expect(await db.select().from(households)).toHaveLength(0);
  });
});

describe("getMembership", () => {
  it("is null for someone without a household", async () => {
    expect(await getMembership(db, "alex")).toBeNull();
  });

  it("only ever returns the user's own household", async () => {
    const kris = await createHousehold(db, "kris", "Kris's kitchen");
    const alex = await createHousehold(db, "alex", "Alex's kitchen");
    expect(kris.householdId).not.toBe(alex.householdId);
    expect((await getMembership(db, "kris"))?.householdId).toBe(kris.householdId);
    expect((await getMembership(db, "alex"))?.householdId).toBe(alex.householdId);
  });

  it("goes when the household is deleted", async () => {
    await createHousehold(db, "kris", "Our kitchen");
    await db.delete(households);
    expect(await getMembership(db, "kris")).toBeNull();
  });
});

describe("householdName", () => {
  it("trims and allows 1 to 50 characters", () => {
    expect(householdName.parse(" Our kitchen ")).toBe("Our kitchen");
    expect(householdName.parse("x".repeat(50))).toHaveLength(50);
    expect(householdName.safeParse("").error?.issues[0].message).toBe("Enter a name for the household");
    expect(householdName.safeParse("x".repeat(51)).error?.issues[0].message).toBe("Keep the name to 50 characters or fewer");
  });
});
