import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Nav, isActive } from "./nav";

const pathname = vi.hoisted(() => ({ current: "/recipes" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

describe("isActive", () => {
  it("matches the tab's page and pages below it", () => {
    expect(isActive("/recipes", "/recipes")).toBe(true);
    expect(isActive("/recipes/lemony-tuna", "/recipes")).toBe(true);
  });

  it("doesn't match other pages that share a prefix", () => {
    expect(isActive("/recipes-old", "/recipes")).toBe(false);
    expect(isActive("/plans", "/recipes")).toBe(false);
    expect(isActive("/", "/recipes")).toBe(false);
  });
});

describe("Nav", () => {
  beforeEach(() => {
    pathname.current = "/recipes";
  });

  it("links to the five tabs in order", () => {
    render(<Nav />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = Array.from(nav.querySelectorAll("a")).map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Recipes", "/recipes"],
      ["Plans", "/plans"],
      ["Import", "/import"],
      ["Compare", "/compare"],
      ["Household", "/household"],
    ]);
  });

  it("marks only the current tab", () => {
    pathname.current = "/plans";
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Plans" })).toHaveAttribute("aria-current", "page");
    for (const name of ["Recipes", "Import", "Compare", "Household"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-current");
    }
  });

  it("keeps the tab active on pages below it", () => {
    pathname.current = "/recipes/lemony-tuna";
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Recipes" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Import when importing", () => {
    pathname.current = "/import";
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Import" })).toHaveAttribute("aria-current", "page");
  });
});
