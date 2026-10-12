import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const requireHousehold = vi.hoisted(() => vi.fn());
vi.mock("@/data", () => ({ requireHousehold }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/recipes" }));

const { default: AppLayout } = await import("./layout");

const RecipesPage = () => <p>Page content</p>;

it("shows the page with the main navigation to a member of a household", async () => {
  requireHousehold.mockResolvedValue({ user: { id: "u1" }, household: { householdId: "h1", name: "Our kitchen", role: "owner" } });
  render(await AppLayout({ children: <RecipesPage /> }));
  expect(requireHousehold).toHaveBeenCalled();
  expect(screen.getByText("Page content")).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
});

it("shows nothing to someone signed out or without a household", async () => {
  requireHousehold.mockRejectedValue(new Error("redirect /welcome"));
  await expect(AppLayout({ children: <RecipesPage /> })).rejects.toThrow("redirect /welcome");
});
