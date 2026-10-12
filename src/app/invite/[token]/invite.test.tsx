import { render, screen } from "@testing-library/react";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { householdInvites, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { createInvite, getMembership, listInvites, revokeInvite } from "@/data";
import { twoHouseholds, type TwoHouseholds } from "@/data/test-fixtures";

type User = { id: string; name: string; email: string; image: null };

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  user: null as User | null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
}));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/auth", () => ({
  auth: async () => (mocks.user ? { user: mocks.user } : null),
  requireUser: async () => {
    if (!mocks.user) throw new Error("redirect /sign-in");
    return mocks.user;
  },
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { default: InvitePage } = await import("./page");
const { joinAction, notYouAction } = await import("./actions");

const NEW: User = { id: "new", name: "New Person", email: "new@example.com", image: null };
let h: TwoHouseholds;
let token: string;

async function show(t = token) {
  render(await InvitePage({ params: Promise.resolve({ token: t }) }));
}

beforeEach(async () => {
  mocks.db = await createTestDb();
  h = await twoHouseholds(mocks.db);
  await mocks.db.insert(users).values(NEW);
  mocks.user = null;
  ({ token } = await createInvite(h.a));
});

describe("invite page", () => {
  it("signed out: says who invited you to what, and asks you to sign in (D)", async () => {
    await show();
    expect(screen.getByText("Kris invited you to join")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Household A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Join/ })).not.toBeInTheDocument();
    // Nothing about the household's members.
    expect(document.body).not.toHaveTextContent(/Sam/);
  });

  it("signed in: an explicit Join button, and who you're signed in as (E)", async () => {
    mocks.user = NEW;
    await show();
    expect(screen.getByRole("button", { name: "Join Household A" })).toBeInTheDocument();
    expect(screen.getByText(/Signed in as new@example.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not you?" })).toBeInTheDocument();
    // Opening the page doesn't join.
    expect(await getMembership("new")).toBeNull();
  });

  it("a made-up link isn't valid", async () => {
    await show("made-up");
    expect(screen.getByRole("heading", { name: "This invite link isn't valid" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("an expired link", async () => {
    await mocks.db.update(householdInvites).set({ expiresAt: sql`now() - interval '1 minute'` });
    mocks.user = NEW;
    await show();
    expect(screen.getByRole("heading", { name: "This invite has expired" })).toBeInTheDocument();
    expect(screen.getByText(/Ask Kris for a new one/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to recipes" })).toHaveAttribute("href", "/recipes");
  });

  it("a used link", async () => {
    await mocks.db.update(householdInvites).set({ usedAt: new Date(), usedBy: "sam" });
    await show();
    expect(screen.getByRole("heading", { name: "This invite has already been used" })).toBeInTheDocument();
  });

  it("a cancelled link", async () => {
    const [{ id }] = await listInvites(h.a);
    await revokeInvite(h.a, id);
    await show();
    expect(screen.getByRole("heading", { name: "This invite was cancelled" })).toBeInTheDocument();
    expect(screen.getByText(/Kris turned this link off/)).toBeInTheDocument();
  });

  it("someone already in this household", async () => {
    mocks.user = { id: "sam", name: "Sam", email: "sam@example.com", image: null };
    await show();
    expect(screen.getByRole("heading", { name: "You're already a member" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to recipes" })).toBeInTheDocument();
  });

  it("someone in another household is told to leave it first", async () => {
    mocks.user = { id: "alex", name: "Alex", email: "alex@example.com", image: null };
    await show();
    expect(screen.getByRole("heading", { name: "You're already in a household" })).toBeInTheDocument();
    expect(screen.getByText(/To join Household A, leave Household B first/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Household settings" })).toHaveAttribute("href", "/household");
  });
});

describe("joinAction", () => {
  it("joins and opens the library", async () => {
    mocks.user = NEW;
    await expect(joinAction(token)).rejects.toThrow("redirect /recipes");
    expect(await getMembership("new")).toMatchObject({ householdId: h.a.householdId, role: "member" });
  });

  it("back to the invite page, which explains, when the link can't be used", async () => {
    mocks.user = NEW;
    await mocks.db.update(householdInvites).set({ revokedAt: new Date() }).where(eq(householdInvites.householdId, h.a.householdId));
    await expect(joinAction(token)).rejects.toThrow(`redirect /invite/${token}`);
    expect(await getMembership("new")).toBeNull();
  });

  it("needs a signed-in user", async () => {
    await expect(joinAction(token)).rejects.toThrow("redirect /sign-in");
  });
});

describe("notYouAction", () => {
  it("signs out and back in with Google's account chooser, returning to the invite", async () => {
    await notYouAction(token);
    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
    expect(mocks.signIn).toHaveBeenCalledWith("google", { redirectTo: `/invite/${token}` }, { prompt: "select_account" });
  });
});
