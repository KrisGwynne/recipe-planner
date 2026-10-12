import { beforeEach, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { twoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  requireUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
}));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { requireHousehold } = await import("./session");

beforeEach(async () => {
  mocks.db = await createTestDb();
});

it("sends someone without a household to the create-household step", async () => {
  await mocks.db.insert(users).values({ id: "new", name: "New" });
  mocks.requireUser.mockResolvedValue({ id: "new" });
  await expect(requireHousehold()).rejects.toThrow("redirect /welcome");
});

it("gives each user the context for their own household", async () => {
  const { a, aMember, b } = await twoHouseholds(mocks.db);

  mocks.requireUser.mockResolvedValue({ id: "kris" });
  const kris = await requireHousehold();
  expect(kris.ctx).toEqual(a);
  expect(kris.household).toMatchObject({ householdId: a.householdId, name: "Household A", role: "owner" });

  mocks.requireUser.mockResolvedValue({ id: "sam" });
  expect((await requireHousehold()).ctx).toEqual(aMember);

  mocks.requireUser.mockResolvedValue({ id: "alex" });
  expect((await requireHousehold()).ctx).toEqual(b);
});
