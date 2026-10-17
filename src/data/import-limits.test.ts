import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { importCounts } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { IMPORTS_PER_HOUR } from "@/recipes/review";
import { reserveImports } from "./import-limits";
import { twoHouseholds, type TwoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));

let h: TwoHouseholds;

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
});

const countFor = async (userId: string) =>
  (await mocks.db.select({ count: importCounts.count }).from(importCounts).where(eq(importCounts.userId, userId)))[0]?.count ?? 0;

/** Moves someone's window back, as if it began `minutes` ago. */
const startedAgo = (userId: string, minutes: number) =>
  mocks.db
    .update(importCounts)
    .set({ windowStart: sql`now() - ${minutes}::float * interval '1 minute'` })
    .where(eq(importCounts.userId, userId));

describe("reserveImports", () => {
  it("is 200 recipes an hour, set in one place", () => {
    expect(IMPORTS_PER_HOUR).toBe(200);
  });

  it("counts recipes up to the limit, then refuses without counting", async () => {
    expect(await reserveImports(h.a, 50, 120)).toEqual({ ok: true });
    expect(await reserveImports(h.a, 50, 120)).toEqual({ ok: true });
    expect(await reserveImports(h.a, 20, 120)).toEqual({ ok: true });
    expect(await countFor("kris")).toBe(120);
    expect(await reserveImports(h.a, 1, 120)).toEqual({ ok: false, retryMinutes: 60 });
    expect(await countFor("kris")).toBe(120);
  });

  it("says how long until the hour is up", async () => {
    await reserveImports(h.a, 10, 10);
    await startedAgo("kris", 50);
    expect(await reserveImports(h.a, 1, 10)).toEqual({ ok: false, retryMinutes: 10 });
    await startedAgo("kris", 59.9);
    expect(await reserveImports(h.a, 1, 10)).toEqual({ ok: false, retryMinutes: 1 });
  });

  it("starts again once the hour is up", async () => {
    await reserveImports(h.a, 10, 10);
    await startedAgo("kris", 61);
    expect(await reserveImports(h.a, 7, 10)).toEqual({ ok: true });
    expect(await countFor("kris")).toBe(7);
  });

  it("counts nothing for nothing", async () => {
    expect(await reserveImports(h.a, 0)).toEqual({ ok: true });
    expect(await countFor("kris")).toBe(0);
  });

  it("refuses a batch bigger than the limit on its own", async () => {
    expect(await reserveImports(h.a, 11, 10)).toMatchObject({ ok: false });
    expect(await countFor("kris")).toBe(0);
  });

  it("goes with the account", async () => {
    await reserveImports(h.aMember, 5);
    await mocks.db.execute(sql`delete from users where id = 'sam'`);
    expect(await mocks.db.select().from(importCounts)).toEqual([]);
  });
});

describe("isolation", () => {
  it("one person's imports never count against another's, in their household or another", async () => {
    await reserveImports(h.a, 10, 10);
    expect(await reserveImports(h.a, 1, 10)).toMatchObject({ ok: false });
    expect(await reserveImports(h.aMember, 10, 10)).toEqual({ ok: true });
    expect(await reserveImports(h.b, 10, 10)).toEqual({ ok: true });
    expect([await countFor("kris"), await countFor("sam"), await countFor("alex")]).toEqual([10, 10, 10]);
  });
});
