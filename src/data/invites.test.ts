import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { householdInvites, householdMembers, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { ForbiddenError } from "./context";
import { getMembership } from "./households";
import { acceptInvite, createInvite, getInvite, hashToken, listInvites, revokeInvite } from "./invites";
import { twoHouseholds, type TwoHouseholds } from "./test-fixtures";

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Db }));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));

let h: TwoHouseholds;

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
  await mocks.db.insert(users).values([
    { id: "new", name: "New Person", email: "new@example.com" },
    { id: "other", name: "Other", email: "other@example.com" },
  ]);
});

const invites = () => mocks.db.select().from(householdInvites);

async function expire(token: string) {
  await mocks.db
    .update(householdInvites)
    .set({ expiresAt: sql`now() - interval '1 minute'` })
    .where(eq(householdInvites.tokenHash, hashToken(token)));
}

describe("createInvite", () => {
  it("stores only a hash of the token, expiring in 7 days", async () => {
    const { token, expiresAt } = await createInvite(h.a);
    expect(token).toMatch(/^[\w-]{43}$/);
    const [row] = await invites();
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row).toMatchObject({ householdId: h.a.householdId, createdBy: "kris", usedAt: null, revokedAt: null });
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(7 * 24 * 3600 * 1000 - 60_000);
  });

  it("makes a different token every time", async () => {
    const [one, two] = await Promise.all([createInvite(h.a), createInvite(h.a)]);
    expect(one.token).not.toBe(two.token);
  });
});

describe("getInvite", () => {
  it("shows only the inviter and the household name", async () => {
    const { token } = await createInvite(h.a);
    const invite = await getInvite(token, null);
    expect(invite).toEqual({
      status: "open",
      householdName: "Household A",
      inviter: { name: "Kris", image: null },
      you: { kind: "signed-out" },
    });
    // Nothing else about the household: no ids, members or counts.
    expect(JSON.stringify(invite)).not.toContain(h.a.householdId);
    expect(JSON.stringify(invite)).not.toMatch(/sam/i);
  });

  it("is null for a link that doesn't exist", async () => {
    await createInvite(h.a);
    expect(await getInvite("made-up", "new")).toBeNull();
  });

  it("says where the viewer stands", async () => {
    const { token } = await createInvite(h.a);
    expect((await getInvite(token, "new"))?.you).toEqual({ kind: "no-household" });
    expect((await getInvite(token, "sam"))?.you).toEqual({ kind: "member" });
    expect((await getInvite(token, "alex"))?.you).toEqual({ kind: "other-household", householdName: "Household B" });
  });

  it("reports expired, used and revoked links", async () => {
    const expired = await createInvite(h.a);
    await expire(expired.token);
    expect((await getInvite(expired.token, null))?.status).toBe("expired");

    const used = await createInvite(h.a);
    await acceptInvite("new", used.token);
    expect((await getInvite(used.token, null))?.status).toBe("used");

    const revoked = await createInvite(h.a);
    const [{ id }] = await mocks.db
      .select({ id: householdInvites.id })
      .from(householdInvites)
      .where(eq(householdInvites.tokenHash, hashToken(revoked.token)));
    await revokeInvite(h.a, id);
    expect((await getInvite(revoked.token, null))?.status).toBe("revoked");
  });
});

describe("acceptInvite", () => {
  it("joins the user as a member and uses up the link", async () => {
    const { token } = await createInvite(h.a);
    expect(await acceptInvite("new", token)).toEqual({ joined: true });
    expect(await getMembership("new")).toEqual({ householdId: h.a.householdId, name: "Household A", role: "member" });
    const [row] = await invites();
    expect(row.usedBy).toBe("new");
    expect(row.usedAt).not.toBeNull();
  });

  it("works once", async () => {
    const { token } = await createInvite(h.a);
    await acceptInvite("new", token);
    expect(await acceptInvite("other", token)).toEqual({ joined: false, reason: "used" });
    expect(await getMembership("other")).toBeNull();
  });

  it("lets only one of two people in at once", async () => {
    const { token } = await createInvite(h.a);
    const results = await Promise.all([acceptInvite("new", token), acceptInvite("other", token)]);
    expect(results.filter((r) => r.joined)).toHaveLength(1);
    expect(await mocks.db.select().from(householdMembers).where(eq(householdMembers.householdId, h.a.householdId))).toHaveLength(3);
  });

  it("refuses expired and revoked links", async () => {
    const expired = await createInvite(h.a);
    await expire(expired.token);
    expect(await acceptInvite("new", expired.token)).toEqual({ joined: false, reason: "expired" });

    const revoked = await createInvite(h.a);
    const [{ id }] = await listInvites(h.a);
    await revokeInvite(h.a, id);
    expect(await acceptInvite("new", revoked.token)).toEqual({ joined: false, reason: "revoked" });
    expect(await getMembership("new")).toBeNull();
  });

  it("refuses a made-up link", async () => {
    expect(await acceptInvite("new", "made-up")).toEqual({ joined: false, reason: "invalid" });
  });

  it("refuses someone already in this household, leaving the link unused", async () => {
    const { token } = await createInvite(h.a);
    expect(await acceptInvite("sam", token)).toEqual({ joined: false, reason: "member" });
    expect((await getInvite(token, null))?.status).toBe("open");
  });

  it("refuses someone in another household, leaving them there and the link unused", async () => {
    const { token } = await createInvite(h.a);
    expect(await acceptInvite("alex", token)).toEqual({ joined: false, reason: "other-household" });
    expect(await getMembership("alex")).toMatchObject({ householdId: h.b.householdId, role: "owner" });
    expect((await getInvite(token, null))?.status).toBe("open");
  });
});

describe("listInvites", () => {
  it("lists only links that can still be used", async () => {
    await createInvite(h.a);
    const used = await createInvite(h.a);
    await acceptInvite("new", used.token);
    const expired = await createInvite(h.a);
    await expire(expired.token);
    const list = await listInvites(h.a);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ createdBy: "Kris" });
  });
});

describe("revokeInvite", () => {
  it("turns a link off once", async () => {
    await createInvite(h.a);
    const [{ id }] = await listInvites(h.a);
    expect(await revokeInvite(h.a, id)).toBe(true);
    expect(await revokeInvite(h.a, id)).toBe(false);
    expect(await listInvites(h.a)).toEqual([]);
  });

  it("can't revoke a used link", async () => {
    const { token } = await createInvite(h.a);
    const [{ id }] = await listInvites(h.a);
    await acceptInvite("new", token);
    expect(await revokeInvite(h.a, id)).toBe(false);
  });

  it("is false for an id that isn't a uuid", async () => {
    expect(await revokeInvite(h.a, "not-a-uuid")).toBe(false);
  });
});

describe("isolation", () => {
  it("household A can't list household B's links", async () => {
    await createInvite(h.b);
    expect(await listInvites(h.a)).toEqual([]);
  });

  it("household A can't revoke household B's link by id", async () => {
    const { token } = await createInvite(h.b);
    const [{ id }] = await listInvites(h.b);
    expect(await revokeInvite(h.a, id)).toBe(false);
    expect((await getInvite(token, null))?.status).toBe("open");
  });

  it("a member can't create, list or revoke links", async () => {
    await createInvite(h.a);
    const [{ id }] = await listInvites(h.a);
    await expect(createInvite(h.aMember)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listInvites(h.aMember)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(revokeInvite(h.aMember, id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await invites()).toHaveLength(1);
    expect((await invites())[0].revokedAt).toBeNull();
  });
});
