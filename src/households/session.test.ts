import { beforeEach, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { createHousehold } from "./index";

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
  await mocks.db.insert(users).values({ id: "kris", name: "Kris" });
  mocks.requireUser.mockResolvedValue({ id: "kris", name: "Kris" });
});

it("sends someone without a household to the create-household step", async () => {
  await expect(requireHousehold()).rejects.toThrow("redirect /welcome");
});

it("returns the user and their household", async () => {
  await createHousehold(mocks.db, "kris", "Our kitchen");
  const { user, household } = await requireHousehold();
  expect(user.id).toBe("kris");
  expect(household).toMatchObject({ name: "Our kitchen", role: "owner" });
});
