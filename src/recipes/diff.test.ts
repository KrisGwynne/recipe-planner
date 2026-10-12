import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Recipe } from "@/types/recipe";
import { diffRecipes, sameRecipe } from "./diff";

const tuna = (): Recipe =>
  JSON.parse(readFileSync(new URL("../../examples/lemony-tuna-tomato-caper-pasta.json", import.meta.url), "utf8"));

describe("sameRecipe", () => {
  it("ignores key order", () => {
    const a = tuna();
    const b = Object.fromEntries(Object.entries(a).reverse()) as unknown as Recipe;
    b.times = { wait_mins: 0, cook_mins: 30, prep_mins: 5, notes: a.times.notes };
    expect(Object.keys(b)[0]).not.toBe(Object.keys(a)[0]);
    expect(sameRecipe(a, b)).toBe(true);
  });

  it("sees any change", () => {
    const b = tuna();
    b.ingredients[0].prep = "extra virgin";
    expect(sameRecipe(tuna(), b)).toBe(false);
  });
});

describe("diffRecipes", () => {
  it("is empty for the same recipe", () => {
    expect(diffRecipes(tuna(), tuna())).toEqual([]);
  });

  it("the design's example (screen D): times, ingredients and spice level", () => {
    const after = tuna();
    after.times.cook_mins = 25;
    after.ingredients.push({ item: "chilli flakes", qty: 1, unit: "pinch", aisle: "herbs-spices" });
    after.ingredients[8].qty = 3; // capers
    after.spice_level = "mild";
    expect(diffRecipes(tuna(), after)).toEqual([
      {
        field: "times",
        label: "Times",
        lines: [
          { kind: "change", label: "Cook", before: "30 min", after: "25 min" },
          { kind: "change", label: "Total", before: "35 min", after: "30 min" },
        ],
      },
      { field: "spice_level", label: "Spice level", lines: [{ kind: "change", before: "None", after: "Mild" }] },
      {
        field: "ingredients",
        label: "Ingredients",
        lines: [
          { kind: "change", label: "capers", before: "2 tbsp", after: "3 tbsp" },
          { kind: "added", text: "chilli flakes, 1 pinch" },
        ],
      },
    ]);
  });

  it("removed ingredients, and other ingredient details", () => {
    const after = tuna();
    after.ingredients = after.ingredients.filter((i) => i.item !== "parsley");
    after.ingredients[0].prep = "extra virgin";
    expect(diffRecipes(tuna(), after)[0].lines).toEqual([
      { kind: "removed", text: "parsley" },
      { kind: "changed", label: "Other details" },
    ]);
  });

  it("nutrition per number", () => {
    const after = tuna();
    after.nutrition_per_serving.kcal = 650;
    after.nutrition_per_serving.source = "estimated";
    expect(diffRecipes(tuna(), after)).toEqual([
      {
        field: "nutrition_per_serving",
        label: "Nutrition",
        lines: [
          { kind: "change", label: "Source", before: "Printed", after: "Estimated" },
          { kind: "change", label: "Calories", before: "672 kcal", after: "650 kcal" },
        ],
      },
    ]);
  });

  it("lists of values: added and removed", () => {
    const after = tuna();
    after.dietary = ["nut-free", "dairy-free"];
    after.meal_type = ["lunch"];
    expect(diffRecipes(tuna(), after).map((c) => [c.label, c.lines])).toEqual([
      [
        "Meal type",
        [
          { kind: "added", text: "Lunch" },
          { kind: "removed", text: "Dinner" },
        ],
      ],
      ["Suitable for", [{ kind: "added", text: "Dairy free" }]],
    ]);
  });

  it("long text just says changed", () => {
    const after = tuna();
    after.description = "A completely rewritten description that is far too long to show inline, by quite a way.";
    after.name = "Tuna pasta";
    expect(diffRecipes(tuna(), after)).toEqual([
      {
        field: "name",
        label: "Name",
        lines: [{ kind: "change", before: "Lemony tuna, tomato & caper one-pot pasta", after: "Tuna pasta" }],
      },
      { field: "description", label: "Description", lines: [{ kind: "changed" }] },
    ]);
  });

  it("method steps and variations", () => {
    const after = tuna();
    after.method[1].text = "Simmer for longer.";
    after.variations[0].description = "Use peppers.";
    after.variations.push({ name: "Spicy", description: "Add chilli." });
    expect(diffRecipes(tuna(), after).map((c) => [c.label, c.lines])).toEqual([
      ["Method", [{ kind: "changed", label: "Step 2" }]],
      [
        "Variations",
        [
          { kind: "added", text: "Spicy" },
          { kind: "changed", label: "Veggie" },
        ],
      ],
    ]);
  });

  it("a different number of steps", () => {
    const after = tuna();
    after.method.pop();
    expect(diffRecipes(tuna(), after)[0].lines).toEqual([{ kind: "change", before: "5 steps", after: "4 steps" }]);
  });

  it("source and storage fields", () => {
    const after = tuna();
    after.source.details = "October 2021, p12";
    after.storage.freezable = true;
    expect(diffRecipes(tuna(), after).map((c) => c.lines)).toEqual([
      [{ kind: "change", label: "Details", before: "September 2021, p63", after: "October 2021, p12" }],
      [{ kind: "change", label: "Freezable", before: "No", after: "Yes" }],
    ]);
  });

  it("proteins", () => {
    const after = tuna();
    after.proteins = [{ category: "fish", item: "salmon" }];
    expect(diffRecipes(tuna(), after)[0].lines).toEqual([
      { kind: "added", text: "Salmon (fish)" },
      { kind: "removed", text: "Tuna (fish, tinned in olive oil)" },
    ]);
  });
});
