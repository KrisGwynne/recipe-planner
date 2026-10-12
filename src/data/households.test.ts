import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { householdMembers, households, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { AlreadyInHouseholdError, createHousehold, getHousehold, getMembership, householdName, listMembers } from "./households";
import { twoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));

beforeEach(async () => {
  mocks.db = await createTestDb();
});

describe("createHousehold", () => {
  beforeEach(async () => {
    await mocks.db.insert(users).values({ id: "new", name: "New", email: "new@example.com" });
  });

  it("makes the user its owner", async () => {
    const membership = await createHousehold("new", "  Our kitchen ");
    expect(membership).toMatchObject({ name: "Our kitchen", role: "owner" });
    expect(await getMembership("new")).toEqual(membership);
  });

  it("refuses a second household, leaving nothing behind", async () => {
    await createHousehold("new", "Our kitchen");
    await expect(createHousehold("new", "Another")).rejects.toBeInstanceOf(AlreadyInHouseholdError);
    expect(await mocks.db.select().from(households)).toHaveLength(1);
    expect(await mocks.db.select().from(householdMembers)).toHaveLength(1);
  });

  it("refuses two created at once", async () => {
    const results = await Promise.allSettled([createHousehold("new", "One"), createHousehold("new", "Two")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await mocks.db.select().from(households)).toHaveLength(1);
  });

  it("refuses an invalid name", async () => {
    await expect(createHousehold("new", "   ")).rejects.toThrow("Enter a name for the household");
    expect(await mocks.db.select().from(households)).toHaveLength(0);
  });
});

describe("getMembership", () => {
  it("is null for someone without a household", async () => {
    await mocks.db.insert(users).values({ id: "new", name: "New" });
    expect(await getMembership("new")).toBeNull();
  });

  it("goes when the household is deleted", async () => {
    await twoHouseholds(mocks.db);
    await mocks.db.delete(households);
    expect(await getMembership("kris")).toBeNull();
  });
});

describe("household isolation", () => {
  it("each member sees their own household", async () => {
    const { a, aMember, b } = await twoHouseholds(mocks.db);
    expect(await getMembership("kris")).toMatchObject({ householdId: a.householdId, name: "Household A", role: "owner" });
    expect(await getMembership("sam")).toMatchObject({ householdId: a.householdId, role: "member" });
    expect(await getMembership("alex")).toMatchObject({ householdId: b.householdId, name: "Household B" });
    expect(aMember.householdId).toBe(a.householdId);
  });

  it("getHousehold returns only the context's household", async () => {
    const { a, b } = await twoHouseholds(mocks.db);
    expect(await getHousehold(a)).toMatchObject({ id: a.householdId, name: "Household A" });
    expect(await getHousehold(b)).toMatchObject({ id: b.householdId, name: "Household B" });
  });

  it("listMembers never includes another household's members", async () => {
    const { a, aMember, b } = await twoHouseholds(mocks.db);
    expect((await listMembers(a)).map((m) => [m.userId, m.role])).toEqual([
      ["kris", "owner"],
      ["sam", "member"],
    ]);
    expect(await listMembers(aMember)).toEqual(await listMembers(a));
    expect((await listMembers(b)).map((m) => m.userId)).toEqual(["alex"]);
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
