import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth, signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { default: SignInPage } = await import("./page");
const { default: SignInErrorPage } = await import("./error/page");

const params = (value: Record<string, string>) => ({ searchParams: Promise.resolve(value) });

describe("sign-in page", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.redirect.mockClear();
  });

  it("offers Google sign-in, with the terms and privacy policy", async () => {
    mocks.auth.mockResolvedValue(null);
    render(await SignInPage(params({})));
    expect(screen.getByRole("heading", { name: "Your recipe book, on your phone." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  it("says when an account has just been deleted", async () => {
    mocks.auth.mockResolvedValue(null);
    render(await SignInPage(params({})));
    expect(screen.queryByText("Your account has been deleted.")).not.toBeInTheDocument();
    render(await SignInPage(params({ deleted: "1" })));
    expect(screen.getByRole("status")).toHaveTextContent("Your account has been deleted.");
  });

  it("sends signed-in visitors on to where they were going", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1" } });
    await expect(SignInPage(params({ callbackUrl: "/plans" }))).rejects.toThrow("redirect /plans");
  });

  it("never sends them to another site", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1" } });
    await expect(SignInPage(params({ callbackUrl: "https://evil.example" }))).rejects.toThrow("redirect /recipes");
  });
});

describe("sign-in error page", () => {
  it("explains in plain language and offers to try again", () => {
    render(<SignInErrorPage />);
    expect(screen.getByRole("heading", { name: "Sign-in didn't work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
