import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryBadge, DietaryBadge, NutritionBadge } from "./badge";

describe("CategoryBadge", () => {
  it("shows the category in its colour", () => {
    render(<CategoryBadge category="vegan" />);
    expect(screen.getByText("Vegan")).toHaveClass("bg-vegan-soft", "text-vegan");
  });

  it("adds the detail after a dot", () => {
    render(<CategoryBadge category="fish" detail="Tuna" />);
    expect(screen.getByText("Fish · Tuna")).toHaveClass("bg-fish-soft");
  });
});

describe("CategoryBadge for meat and fish", () => {
  it("is neutral, with a meat dot then a fish dot", () => {
    const { container } = render(<CategoryBadge category="meat-and-fish" detail="Chicken, prawns" />);
    expect(screen.getByText("Meat & fish · Chicken, prawns")).toHaveClass("bg-surface-2", "text-ink");
    const dots = [...container.querySelectorAll(".rounded-full.size-2")].map((dot) => dot.className);
    expect(dots).toEqual([expect.stringContaining("bg-meat"), expect.stringContaining("bg-fish")]);
  });
});

describe("NutritionBadge", () => {
  it("shows printed nutrition plainly", () => {
    render(<NutritionBadge source="printed" />);
    expect(screen.getByText("Printed")).not.toHaveClass("border-dashed");
  });

  it("shows estimates with a dashed outline and ~, not just colour", () => {
    render(<NutritionBadge source="estimated" />);
    expect(screen.getByText("~ Estimated")).toHaveClass("border-dashed");
  });
});

describe("DietaryBadge", () => {
  it("labels each flag", () => {
    render(<DietaryBadge flag="gluten-free" />);
    expect(screen.getByText("Gluten-free")).toHaveClass("border-line");
  });

  it("shows vegetarian in the veg colour", () => {
    render(<DietaryBadge flag="vegetarian" />);
    expect(screen.getByText("Vegetarian")).toHaveClass("border-veg", "text-veg");
  });
});
