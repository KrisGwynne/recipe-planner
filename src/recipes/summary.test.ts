import { describe, expect, it } from "vitest";
import { toRecipeSummary, type RecipeListRow } from "./summary";

const tuna: RecipeListRow = {
  slug: "lemony-tuna-tomato-caper-pasta",
  name: "Lemony tuna, tomato & caper one-pot pasta",
  totalMins: 35,
  kcal: 672.4,
  proteinG: 28.6,
  nutritionSource: "printed",
  proteinType: "fish",
  proteinItems: ["tuna"],
  dietary: [],
  carbs: ["pasta"],
  hasVeggieOption: false,
};

describe("toRecipeSummary", () => {
  it("links to the recipe by slug, with whole kcal and protein", () => {
    expect(toRecipeSummary(tuna)).toEqual({
      name: tuna.name,
      href: "/recipes/lemony-tuna-tomato-caper-pasta",
      totalMins: 35,
      kcal: 672,
      proteinG: 29,
      nutritionSource: "printed",
      category: "fish",
      categoryDetail: "Tuna",
      carbs: ["Pasta"],
      veggieOption: false,
    });
  });

  it("names every meat and fish item for meat & fish, leaving out other and vegetarian items", () => {
    const summary = toRecipeSummary({
      ...tuna,
      proteinType: "meat-and-fish",
      proteinItems: ["chicken", "white-fish", "egg", "other", "smoked-fish"],
    });
    expect(summary.category).toBe("meat-and-fish");
    expect(summary.categoryDetail).toBe("Chicken, white fish, smoked fish");
  });

  it("has no detail when the only item is other", () => {
    expect(toRecipeSummary({ ...tuna, proteinType: "meat", proteinItems: ["other"] }).categoryDetail).toBeUndefined();
  });

  it("shows vegetarian as Veg and vegan as Vegan, without items or a veggie option", () => {
    const veg = { ...tuna, proteinType: "vegetarian" as const, proteinItems: ["tofu"], hasVeggieOption: true };
    expect(toRecipeSummary(veg)).toMatchObject({ category: "veg", categoryDetail: undefined, veggieOption: false });
    expect(toRecipeSummary({ ...veg, dietary: ["vegetarian", "vegan"] }).category).toBe("vegan");
  });

  it("shows the veggie option on meat and fish recipes that have one", () => {
    expect(toRecipeSummary({ ...tuna, hasVeggieOption: true }).veggieOption).toBe(true);
  });

  it("labels carbs, and leaves none out so the card says No carbs", () => {
    expect(toRecipeSummary({ ...tuna, carbs: ["rice", "bread"] }).carbs).toEqual(["Rice", "Bread"]);
    expect(toRecipeSummary({ ...tuna, carbs: ["none"] }).carbs).toEqual([]);
  });
});
