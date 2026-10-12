import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ requireUser, signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/recipes" }));

const { default: AppLayout } = await import("./layout");
const { default: RecipesPage } = await import("./recipes/page");

it("shows the page with the main navigation to a signed-in user", async () => {
  requireUser.mockResolvedValue({ id: "u1" });
  render(await AppLayout({ children: <RecipesPage /> }));
  expect(requireUser).toHaveBeenCalled();
  expect(screen.getByRole("heading", { level: 1, name: "Recipes" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Import recipes" })).toHaveAttribute("href", "/import");
});

it("shows nothing to a signed-out user", async () => {
  requireUser.mockRejectedValue(new Error("redirect /sign-in"));
  await expect(AppLayout({ children: <RecipesPage /> })).rejects.toThrow("redirect /sign-in");
});
