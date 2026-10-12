import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Recipe } from "@/types/recipe";
import { RecipeView } from "./recipe-view";

// jsdom changes import.meta.url, so read from the project root.
const example = (slug: string): Recipe => JSON.parse(readFileSync(`examples/${slug}.json`, "utf8"));
const tuna = example("lemony-tuna-tomato-caper-pasta");
const tofoo = example("char-siu-tofoo-noodles");

const show = (recipe: Recipe) => render(<RecipeView recipe={recipe} header={<span>header</span>} />);
const amounts = () =>
  within(screen.getByRole("region", { name: "Ingredients" }))
    .getAllByRole("button", { pressed: false })
    .map((b) => b.querySelector("span")?.textContent);

describe("RecipeView", () => {
  it("shows the top of the page (design A)", () => {
    show(tuna);
    expect(screen.getByRole("heading", { level: 1, name: tuna.name })).toBeInTheDocument();
    expect(screen.getByText("BBC Good Food · September 2021, p63")).toBeInTheDocument();
    expect(screen.getByText(tuna.description!)).toBeInTheDocument();
    expect(screen.getByText("Total").nextSibling).toHaveTextContent("35 min");
    expect(screen.getByText("Printed cook time already includes the 5-min rest.")).toBeInTheDocument();
    expect(screen.getByText("Pasta · rigatoni")).toBeInTheDocument();
    expect(screen.getByText("Fish · Tuna")).toBeInTheDocument();
    expect(screen.getByText("Nut-free")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Per serving/ })).toHaveAttribute("href", "#nutrition");
  });

  it("scales the tuna pasta from 4 to 2: every quantity halves, to-taste items don't (acceptance criteria)", () => {
    show({ ...tuna, ingredients: [...tuna.ingredients, { item: "salt", qty: null, unit: null, aisle: "herbs-spices" }] });
    expect(screen.getByText("4 servings")).toBeInTheDocument();
    expect(screen.queryByText(/from 4 servings/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fewer servings" }));
    fireEvent.click(screen.getByRole("button", { name: "Fewer servings" }));
    expect(screen.getByText("2 servings")).toBeInTheDocument();
    expect(screen.getByText("Halved from 4 servings")).toBeInTheDocument();
    expect(amounts()).toEqual([
      "1 tbsp",
      "½",
      "250 g",
      "200 g",
      "500 ml",
      "1 can",
      "1½ tbsp",
      "15 g",
      "1 tbsp",
      "¼",
      "½ bunch",
      "",
    ]);
    // Notes don't scale, so they say which servings they're for; gram totals do scale.
    expect(screen.getByText(/350g in step 2, 150g in step 3/)).toHaveTextContent("(for 4)");
    expect(screen.getByText(/110g cans/)).toHaveTextContent("110g cans · 110g total");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("4 servings")).toBeInTheDocument();
    expect(amounts()[0]).toBe("2 tbsp");
  });

  it("puts ungrouped ingredients first, then each group (design C)", () => {
    show(tofoo);
    const section = screen.getByRole("region", { name: "Ingredients" });
    expect(within(section).getByRole("heading", { name: "char siu sauce" })).toBeInTheDocument();
    const items = within(section).getAllByRole("button", { pressed: false }).map((b) => b.textContent ?? "");
    expect(items.findIndex((t) => t.includes("hoisin"))).toBeGreaterThan(items.findIndex((t) => t.includes("cornflour")));
  });

  it("ticks off ingredients and steps", () => {
    show(tuna);
    const oil = screen.getByRole("button", { name: "2 tbsp olive oil" });
    fireEvent.click(oil);
    expect(oil).toHaveAttribute("aria-pressed", "true");
    const step = screen.getByRole("button", { name: /Heat the oil/ });
    fireEvent.click(step);
    expect(step).toHaveAttribute("aria-pressed", "true");
    expect(step).toHaveTextContent("Step 1, done");
  });

  it("shows ~ on every number and a dashed outline for estimated nutrition (acceptance criteria)", () => {
    show(tofoo);
    const panel = screen.getByRole("region", { name: "Nutrition per serving" });
    expect(within(panel).getByText("Not printed in the book; estimated by Claude when the recipe was imported.")).toBeInTheDocument();
    const values = within(panel).getAllByRole("cell").map((c) => c.textContent);
    expect(values).toHaveLength(7);
    for (const v of values) expect(v).toMatch(/^~/);
    expect(within(panel).getByText("~825")).toBeInTheDocument();
    expect(within(panel).getByText("~825").closest("div")).toHaveClass("border-dashed");
  });

  it("shows printed nutrition without ~, and the energy split", () => {
    show(tuna);
    const panel = screen.getByRole("region", { name: "Nutrition per serving" });
    expect(within(panel).getByRole("row", { name: "Salt 1.5 g" })).toBeInTheDocument();
    expect(within(panel).getByText("As printed in the magazine.")).toBeInTheDocument();
    // 29×4, 83×4, 23×9 = 116, 332, 207 of 655.
    expect(within(panel).getByText(/Protein 18%/)).toBeInTheDocument();
    expect(within(panel).getByText(/Carbs 51%/)).toBeInTheDocument();
    expect(within(panel).getByText(/Fat 32%/)).toBeInTheDocument();
  });

  it("shows variations with what they change, and the recipe's details", () => {
    show(tuna);
    expect(screen.getByText("no meat or fish · Nut-free")).toBeInTheDocument();
    const details = screen.getByRole("region", { name: "From the recipe" });
    expect(within(details).getByText("Magazine · September 2021, p63")).toBeInTheDocument();
    expect(within(details).getByText("Not freezable · Good for leftovers")).toBeInTheDocument();
    expect(within(details).getByText("one-pot · quick")).toBeInTheDocument();
  });

  it("links a source with a URL", () => {
    show({ ...tuna, source: { kind: "website", title: "BBC Good Food", url: "https://www.bbcgoodfood.com/recipes/x" } });
    expect(screen.getByRole("link", { name: "BBC Good Food" })).toHaveAttribute("href", "https://www.bbcgoodfood.com/recipes/x");
  });

  it("has section links", () => {
    show(tuna);
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "#ingredients",
      "#method",
      "#nutrition",
      "#notes",
    ]);
  });
});
