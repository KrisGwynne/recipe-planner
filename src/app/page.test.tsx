import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
  push: vi.fn(),
  back: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, useRouter: () => ({ push: mocks.push, back: mocks.back }) }));

const { default: Home } = await import("./page");
const { default: PrivacyPage } = await import("./privacy/page");
const { default: TermsPage } = await import("./terms/page");

const params = (value: Record<string, string> = {}) => ({ searchParams: Promise.resolve(value) });

beforeEach(() => vi.clearAllMocks());

describe("the landing page (onboarding A)", () => {
  it("is the sign-in page for signed-out visitors, linking the terms and privacy policy", async () => {
    mocks.auth.mockResolvedValue(null);
    render(await Home(params()));
    expect(screen.getByRole("heading", { name: "Your recipe book, on your phone." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  it("sends signed-in visitors to their recipes", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1" } });
    await expect(Home(params())).rejects.toThrow("redirect /recipes");
  });
});

describe("the privacy policy (legal design A)", () => {
  it("says what's stored, where, and how to delete it", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeInTheDocument();
    for (const heading of ["What's stored", "Who can see it", "Where it's kept", "How long it's kept", "Deleting it", "Your rights"]) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    }
    const page = document.body.textContent ?? "";
    expect(page).toContain("your name, email address and profile photo");
    expect(page).toContain("the recipes you import");
    expect(page).toContain("with Neon, in London");
    expect(page).toContain("There are no backups");
    expect(page).toContain("Delete my account");
  });

  it("names nobody and gives no email address (Kris, 2026-10-17)", () => {
    render(<PrivacyPage />);
    render(<TermsPage />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Kris|Gwynne|@/);
  });
});

describe("the terms (legal design B)", () => {
  it("has the nutrition disclaimer and links the privacy policy", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms" })).toBeInTheDocument();
    expect(document.body).toHaveTextContent("It's a guide, not medical or dietary advice.");
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  it("goes back to the landing page when opened from outside the app", () => {
    render(<TermsPage />);
    screen.getByRole("button", { name: "Back" }).click();
    expect(mocks.push).toHaveBeenCalledWith("/");
  });
});
