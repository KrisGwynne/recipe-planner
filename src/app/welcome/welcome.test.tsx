import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { createHousehold, deleteHousehold, getMembership } from "@/data";
import { contextFor } from "@/data/context";

const mocks = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  user: { id: "kris", name: "Kris Gwynne", email: "kris@example.com", image: null as string | null },
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
}));
vi.mock("@/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/auth", () => ({ requireUser: async () => mocks.user, signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { default: WelcomePage } = await import("./page");
const { createHouseholdAction } = await import("./actions");

const form = (name: string) => {
  const data = new FormData();
  data.set("name", name);
  return data;
};

beforeEach(async () => {
  mocks.db = await createTestDb();
  await mocks.db.insert(users).values({ id: "kris", name: "Kris Gwynne", email: "kris@example.com" });
  mocks.user.image = null;
});

describe("welcome page", () => {
  it("welcomes the user by first name and asks for a household name", async () => {
    render(await WelcomePage());
    expect(screen.getByRole("heading", { name: "Welcome, Kris" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Household name/ })).toHaveAttribute("placeholder", "e.g. Our kitchen");
    expect(screen.getByText("K")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create household" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("shows the Google photo when there is one", async () => {
    mocks.user.image = "https://lh3.googleusercontent.com/a/kris";
    const { container } = render(await WelcomePage());
    // next/image serves it through the image optimiser.
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      encodeURIComponent("https://lh3.googleusercontent.com/a/kris"),
    );
  });

  it("says which household they're no longer in, after leaving one (household design M)", async () => {
    await createHousehold("kris", "Our kitchen");
    const membership = await getMembership("kris");
    await deleteHousehold(contextFor({ userId: "kris", householdId: membership!.householdId, role: "owner" }), "Our kitchen");
    render(await WelcomePage());
    expect(screen.getByRole("status")).toHaveTextContent(
      "You're no longer in Our kitchen. Start your own household, or open an invite link to join one.",
    );
  });

  it("has no note for someone who's never been in a household", async () => {
    render(await WelcomePage());
    expect(screen.queryByText(/no longer in/)).not.toBeInTheDocument();
  });

  it("sends someone who already has a household to the app", async () => {
    await createHousehold("kris", "Our kitchen");
    await expect(WelcomePage()).rejects.toThrow("redirect /recipes");
  });

  it("shows a problem with the name next to the field", async () => {
    render(await WelcomePage());
    fireEvent.click(screen.getByRole("button", { name: "Create household" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Enter a name for the household"));
    expect(screen.getByRole("textbox", { name: /Household name/ })).toHaveAttribute("aria-invalid", "true");
  });
});

describe("createHouseholdAction", () => {
  it("creates the household with the user as owner, then offers an invite link", async () => {
    await expect(createHouseholdAction({ name: "" }, form(" Our kitchen "))).rejects.toThrow("redirect /welcome/invite");
    expect(await getMembership("kris")).toMatchObject({ name: "Our kitchen", role: "owner" });
  });

  it("keeps what was typed when the name is invalid", async () => {
    expect(await createHouseholdAction({ name: "" }, form("x".repeat(51)))).toEqual({
      name: "x".repeat(51),
      error: "Keep the name to 50 characters or fewer",
    });
    expect(await getMembership("kris")).toBeNull();
  });

  it("carries on into the app if a household already exists", async () => {
    await createHousehold("kris", "Our kitchen");
    await expect(createHouseholdAction({ name: "" }, form("Another"))).rejects.toThrow("redirect /recipes");
    expect(await getMembership("kris")).toMatchObject({ name: "Our kitchen" });
  });
});
