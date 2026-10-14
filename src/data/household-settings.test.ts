import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { householdInvites, householdMembers, households, mealPlans, recipeCooks, recipeHouseholdData, recipes, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import type { Recipe } from "@/types/recipe";
import { ForbiddenError, contextFor } from "./context";
import {
  deleteHousehold,
  getDeparture,
  getHousehold,
  getMembership,
  householdCounts,
  leaveHousehold,
  listMembers,
  removeMember,
  renameHousehold,
  setRole,
} from "./households";
import { createInvite } from "./invites";
import { createPlan } from "./plans";
import { markCooked, setRating } from "./recipe-household";
import { saveRecipe } from "./recipes";
import { twoHouseholds, type TwoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));

const tuna: Recipe = JSON.parse(
  readFileSync(new URL("../../examples/lemony-tuna-tomato-caper-pasta.json", import.meta.url), "utf8"),
);

let h: TwoHouseholds;

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
});

/** Sam as an owner of household A, as requireHousehold would make after a role change. */
const samAsOwner = () => contextFor({ userId: "sam", householdId: h.a.householdId, role: "owner" });
const roles = async () => (await listMembers(h.a)).map((m) => [m.userId, m.role]);

describe("renameHousehold", () => {
  it("renames, trimmed, for owners only", async () => {
    expect(await renameHousehold(h.a, "  The Gwynne kitchen ")).toBe("The Gwynne kitchen");
    expect((await getHousehold(h.a)).name).toBe("The Gwynne kitchen");
    await expect(renameHousehold(h.a, "")).rejects.toThrow("Enter a name for the household");
    await expect(renameHousehold(h.aMember, "Mine")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("setRole", () => {
  it("makes a member an owner and back", async () => {
    expect(await setRole(h.a, "sam", "owner")).toBe(true);
    expect(await roles()).toEqual([
      ["kris", "owner"],
      ["sam", "owner"],
    ]);
    expect(await setRole(samAsOwner(), "kris", "member")).toBe(true);
    expect(await roles()).toEqual([
      ["sam", "owner"],
      ["kris", "member"],
    ]);
  });

  it("doesn't change your own role, or anyone's as a member", async () => {
    expect(await setRole(h.a, "kris", "member")).toBe(false);
    await expect(setRole(h.aMember, "kris", "member")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await roles()).toEqual([
      ["kris", "owner"],
      ["sam", "member"],
    ]);
  });
});

describe("removeMember", () => {
  it("removes someone, who then sees the note", async () => {
    expect(await removeMember(h.a, "sam")).toBe(true);
    expect(await getMembership("sam")).toBeNull();
    expect(await getDeparture("sam")).toBe("Household A");
    expect(await roles()).toEqual([["kris", "owner"]]);
  });

  it("doesn't remove yourself, someone not in the household, or anyone as a member", async () => {
    expect(await removeMember(h.a, "kris")).toBe(false);
    expect(await removeMember(h.a, "nobody")).toBe(false);
    await expect(removeMember(h.aMember, "kris")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getDeparture("nobody")).toBeNull();
    expect((await roles()).length).toBe(2);
  });

  it("keeps what they added", async () => {
    await saveRecipe(h.aMember, tuna);
    await removeMember(h.a, "sam");
    expect(await mocks.db.select().from(recipes)).toHaveLength(1);
  });
});

describe("leaveHousehold", () => {
  it("lets a member leave", async () => {
    expect(await leaveHousehold(h.aMember)).toBe(true);
    expect(await getMembership("sam")).toBeNull();
    expect(await getDeparture("sam")).toBe("Household A");
  });

  it("doesn't let the last owner leave (design I)", async () => {
    expect(await leaveHousehold(h.a)).toBe(false);
    expect(await getMembership("kris")).toMatchObject({ role: "owner" });
    // Nor the only person in a household.
    expect(await leaveHousehold(h.b)).toBe(false);
    expect(await getDeparture("kris")).toBeNull();
  });

  it("lets an owner leave once someone else is an owner", async () => {
    await setRole(h.a, "sam", "owner");
    expect(await leaveHousehold(h.a)).toBe(true);
    expect(await roles()).toEqual([["sam", "owner"]]);
    // Sam is now the last owner.
    expect(await leaveHousehold(samAsOwner())).toBe(false);
  });

  it("replaces an older note", async () => {
    await leaveHousehold(h.aMember);
    // Sam joins B, which is renamed, and leaves it too.
    await mocks.db.insert(householdMembers).values({ householdId: h.b.householdId, userId: "sam", role: "member" });
    await mocks.db.update(households).set({ name: "Renamed" }).where(eq(households.id, h.b.householdId));
    await leaveHousehold(contextFor({ userId: "sam", householdId: h.b.householdId, role: "member" }));
    expect(await getDeparture("sam")).toBe("Renamed");
  });
});

describe("deleteHousehold", () => {
  beforeEach(async () => {
    const recipe = await saveRecipe(h.a, tuna);
    await setRating(h.a, recipe.id, 4);
    await markCooked(h.a, recipe.id, "2026-10-02");
    await createPlan(h.a, { name: "This week", startDate: "2026-10-12", days: 7, people: 2 });
    await createInvite(h.a);
  });

  it("counts what will go", async () => {
    expect(await householdCounts(h.a)).toEqual({ recipes: 1, plans: 1 });
    expect(await householdCounts(h.b)).toEqual({ recipes: 0, plans: 0 });
  });

  it("needs the name typed", async () => {
    expect(await deleteHousehold(h.a, "Household")).toBe(false);
    expect(await getMembership("kris")).not.toBeNull();
  });

  it("deletes the household and everything in it, for everyone", async () => {
    expect(await deleteHousehold(h.a, "  household a ")).toBe(true);
    expect(await getMembership("kris")).toBeNull();
    expect(await getMembership("sam")).toBeNull();
    expect(await getDeparture("kris")).toBe("Household A");
    expect(await getDeparture("sam")).toBe("Household A");
    for (const table of [recipes, recipeHouseholdData, recipeCooks, mealPlans, householdInvites]) {
      expect(await mocks.db.select().from(table)).toEqual([]);
    }
    // The accounts stay (deleting an account is PP-158).
    expect(await mocks.db.select({ id: users.id }).from(users)).toHaveLength(3);
  });

  it("is for owners only", async () => {
    await expect(deleteHousehold(h.aMember, "Household A")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("household isolation", () => {
  it("A's owner can't rename, delete, or change or remove B's members", async () => {
    await renameHousehold(h.a, "Ours");
    expect((await getHousehold(h.b)).name).toBe("Household B");
    expect(await setRole(h.a, "alex", "member")).toBe(false);
    expect(await removeMember(h.a, "alex")).toBe(false);
    expect(await deleteHousehold(h.a, "Household B")).toBe(false);
    expect(await getMembership("alex")).toMatchObject({ householdId: h.b.householdId, role: "owner" });
    expect(await getDeparture("alex")).toBeNull();
  });

  it("counts only the household's own recipes and plans", async () => {
    await saveRecipe(h.b, tuna);
    expect(await householdCounts(h.a)).toEqual({ recipes: 0, plans: 0 });
  });
});
