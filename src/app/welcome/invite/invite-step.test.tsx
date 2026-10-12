import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { householdInvites } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { twoHouseholds } from "@/data/test-fixtures";
import { InviteLink } from "./invite-link";

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  user: { id: "kris", name: "Kris", email: "kris@example.com", image: null },
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
}));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/auth", () => ({ requireUser: async () => mocks.user }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { default: InviteStepPage } = await import("./page");
const { createInviteAction } = await import("./actions");

beforeEach(async () => {
  mocks.db = await createTestDb();
  await twoHouseholds(mocks.db);
  mocks.user = { id: "kris", name: "Kris", email: "kris@example.com", image: null };
});

describe("invite step page (C)", () => {
  it("says the household is ready and makes no link until asked", async () => {
    render(await InviteStepPage());
    expect(screen.getByRole("heading", { name: "Household A is ready" })).toBeInTheDocument();
    expect(screen.getByText("Tap Copy or Share to make a link")).toBeInTheDocument();
    expect(screen.getByText("Works once, for one person, and expires in 7 days.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Done, go to recipes" })).toHaveAttribute("href", "/recipes");
    expect(screen.getByRole("link", { name: "Skip for now" })).toHaveAttribute("href", "/recipes");
    expect(await mocks.db.select().from(householdInvites)).toHaveLength(0);
  });

  it("is only for owners", async () => {
    mocks.user = { id: "sam", name: "Sam", email: "sam@example.com", image: null };
    await expect(InviteStepPage()).rejects.toThrow("redirect /recipes");
  });

  it("createInviteAction makes a link for the owner's household", async () => {
    expect(await createInviteAction()).toMatch(/^\/invite\/[\w-]{43}$/);
    expect(await mocks.db.select().from(householdInvites)).toHaveLength(1);
  });

  it("createInviteAction refuses a member", async () => {
    mocks.user = { id: "sam", name: "Sam", email: "sam@example.com", image: null };
    await expect(createInviteAction()).rejects.toThrow();
    expect(await mocks.db.select().from(householdInvites)).toHaveLength(0);
  });
});

describe("InviteLink", () => {
  const writeText = vi.fn(async (_text: string) => {});

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeText.mockClear();
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
  });

  it("makes the link on the first Copy, and reuses it after", async () => {
    const createLink = vi.fn(async () => "/invite/abc");
    render(<InviteLink createLink={createLink} householdName="Our kitchen" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/invite/abc");
    expect(screen.getByText("localhost:3000/invite/abc")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copied" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(createLink).toHaveBeenCalledTimes(1);
  });

  it("says so when the link can't be made, and tries again on the next tap", async () => {
    const createLink = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue("/invite/abc");
    render(<InviteLink createLink={createLink} householdName="Our kitchen" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Couldn't make a link. Try again."));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("http://localhost:3000/invite/abc"));
  });

  it("hides Share without a share sheet", () => {
    render(<InviteLink createLink={async () => "/invite/abc"} householdName="Our kitchen" />);
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
  });

  it("shares the link through the share sheet", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<InviteLink createLink={async () => "/invite/abc"} householdName="Our kitchen" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share" })));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: "http://localhost:3000/invite/abc", title: "Join Our kitchen" }),
    );
  });
});
