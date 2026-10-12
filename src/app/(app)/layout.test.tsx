import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AppLayout from "./layout";
import RecipesPage from "./recipes/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/recipes" }));

it("shows the page with the main navigation", () => {
  render(
    <AppLayout>
      <RecipesPage />
    </AppLayout>,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Recipes" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Import recipes" })).toHaveAttribute("href", "/import");
});
