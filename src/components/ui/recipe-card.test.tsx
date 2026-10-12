import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeCard, RecipeRow, type RecipeSummary } from "./recipe-card";

const tuna: RecipeSummary = {
  name: "Lemony tuna, tomato & caper one-pot pasta",
  href: "/recipes/lemony-tuna",
  totalMins: 35,
  kcal: 672,
  proteinG: 29,
  nutritionSource: "printed",
  category: "fish",
  categoryDetail: "Tuna",
  carbs: ["Pasta"],
};

const tofoo: RecipeSummary = {
  ...tuna,
  name: "Char siu Tofoo noodles",
  href: "/recipes/char-siu-tofoo",
  totalMins: 55,
  kcal: 825,
  proteinG: 31,
  nutritionSource: "estimated",
  category: "veg",
  categoryDetail: undefined,
  carbs: ["Noodles"],
};

describe("RecipeCard", () => {
  it("links to the recipe and shows its numbers and badges", () => {
    render(<RecipeCard recipe={tuna} />);
    expect(screen.getByRole("link", { name: tuna.name })).toHaveAttribute("href", "/recipes/lemony-tuna");
    expect(screen.getByText("35 min")).toBeInTheDocument();
    expect(screen.getByText("672 kcal")).toBeInTheDocument();
    expect(screen.getByText("29g")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();
    expect(screen.getByText("Fish · Tuna")).toBeInTheDocument();
    expect(screen.getByText("Printed")).toBeInTheDocument();
  });

  it("marks estimated nutrition with ~", () => {
    render(<RecipeCard recipe={tofoo} />);
    expect(screen.getByText("~825 kcal")).toBeInTheDocument();
    expect(screen.getByText("~31g protein")).toBeInTheDocument();
    expect(screen.getByText("~ Estimated")).toBeInTheDocument();
  });

  it("shows No carbs and the veggie option", () => {
    render(<RecipeCard recipe={{ ...tuna, carbs: [], veggieOption: true }} />);
    expect(screen.getByText("No carbs")).toHaveClass("text-ink-muted");
    expect(screen.getByText("+ Veggie option")).toBeInTheDocument();
  });

  it("leaves out the veggie option line when there isn't one", () => {
    render(<RecipeCard recipe={tuna} />);
    expect(screen.queryByText("+ Veggie option")).not.toBeInTheDocument();
  });

  it("has no favourite button unless it can be toggled", () => {
    render(<RecipeCard recipe={tuna} />);
    expect(screen.queryByRole("button", { name: "Favourite" })).not.toBeInTheDocument();
  });

  it("toggles the favourite", () => {
    const onToggle = vi.fn();
    render(<RecipeCard recipe={tuna} favourite onToggleFavourite={onToggle} />);
    const heart = screen.getByRole("button", { name: "Favourite" });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(heart);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe("RecipeRow", () => {
  it("links to the recipe with its facts on one line", () => {
    render(<RecipeRow recipe={tofoo} />);
    const row = screen.getByRole("link");
    expect(row).toHaveAttribute("href", "/recipes/char-siu-tofoo");
    expect(screen.getByText("55 min · ~825 kcal · ~31g protein · Noodles")).toBeInTheDocument();
  });

  it("says No carbs in the facts", () => {
    render(<RecipeRow recipe={{ ...tofoo, carbs: [] }} />);
    expect(screen.getByText("55 min · ~825 kcal · ~31g protein · No carbs")).toBeInTheDocument();
  });

  it("splits the bar for meat and fish, meat above fish", () => {
    render(<RecipeRow recipe={{ ...tuna, category: "meat-and-fish" }} />);
    const bar = screen.getByRole("link").querySelector("[aria-hidden=true]");
    expect([...bar!.children].map((part) => part.className)).toEqual(["flex-1 bg-meat", "flex-1 bg-fish"]);
    expect(screen.getByRole("link")).toHaveTextContent("Meat & fish");
  });

  it("names the category for screen readers, not just by colour", () => {
    render(<RecipeRow recipe={tuna} />);
    expect(screen.getByRole("link")).toHaveTextContent("Fish");
  });
});
