// The Auth.js Drizzle adapter against our schema and migrations, in PGlite.
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { beforeEach, describe, expect, it } from "vitest";
import { accounts, sessions, users } from "./schema";
import { createTestDb } from "./test-db";
import type { Db } from "./index";

let db: Db;
let adapter: Required<Adapter>;

beforeEach(async () => {
  db = await createTestDb();
  adapter = DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions }) as Required<Adapter>;
});

const googleAccount = (userId: string, sub = "google-sub-1"): AdapterAccount => ({
  userId,
  type: "oidc",
  provider: "google",
  providerAccountId: sub,
  access_token: "token",
  token_type: "bearer",
  scope: "openid email profile",
  id_token: "id-token",
  expires_at: 1_900_000_000,
});

describe("Auth.js adapter", () => {
  it("creates a user and their Google account on first sign-in", async () => {
    const user = await adapter.createUser({
      id: "ignored",
      name: "Kris",
      email: "kris@example.com",
      emailVerified: null,
      image: "https://example.com/kris.png",
    });
    await adapter.linkAccount(googleAccount(user.id));

    const found = await adapter.getUserByAccount({ provider: "google", providerAccountId: "google-sub-1" });
    expect(found).toMatchObject({ id: user.id, name: "Kris", email: "kris@example.com", image: "https://example.com/kris.png" });

    const [row] = await db.select().from(users);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("finds the same user on the next sign-in, without duplicating them", async () => {
    const user = await adapter.createUser({ id: "x", name: "Kris", email: "kris@example.com", emailVerified: null });
    await adapter.linkAccount(googleAccount(user.id));

    expect((await adapter.getUserByAccount({ provider: "google", providerAccountId: "google-sub-1" }))?.id).toBe(user.id);
    await expect(adapter.linkAccount(googleAccount(user.id))).rejects.toThrow();
    expect(await db.select().from(users)).toHaveLength(1);
    expect(await db.select().from(accounts)).toHaveLength(1);
  });

  it("keeps a session until sign-out", async () => {
    const user = await adapter.createUser({ id: "x", name: "Kris", email: "kris@example.com", emailVerified: null });
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await adapter.createSession({ sessionToken: "session-1", userId: user.id, expires });

    const found = await adapter.getSessionAndUser("session-1");
    expect(found?.user.id).toBe(user.id);
    expect(found?.session.expires.getTime()).toBe(expires.getTime());

    await adapter.deleteSession("session-1");
    expect(await adapter.getSessionAndUser("session-1")).toBeNull();
  });

  it("removes a user's accounts and sessions with them", async () => {
    const user = await adapter.createUser({ id: "x", name: "Kris", email: "kris@example.com", emailVerified: null });
    await adapter.linkAccount(googleAccount(user.id));
    await adapter.createSession({ sessionToken: "session-1", userId: user.id, expires: new Date(Date.now() + 60_000) });

    await adapter.deleteUser(user.id);
    expect(await db.select().from(accounts)).toHaveLength(0);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
});
