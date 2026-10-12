import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Ingredient, Recipe } from "@/types/recipe";
import { formatAmount, gramsTotal, groupIngredients, kitchenNumber, notesFor, scaledAmount, scaledBanner } from "./quantity";

const example = (slug: string): Recipe =>
  JSON.parse(readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8"));
const tuna = example("lemony-tuna-tomato-caper-pasta");
const tofoo = example("char-siu-tofoo-noodles");

describe("scaling the tuna pasta from 4 to 2 (acceptance criteria)", () => {
  it("halves every quantity", () => {
    expect(tuna.ingredients.map((i) => scaledAmount(i, 4, 2))).toEqual([
      "1 tbsp", // olive oil, 2 tbsp
      "½", // red onion, 1
      "250 g", // cherry tomatoes, 500 g
      "200 g", // pasta, 400 g
      "500 ml", // stock, 1 l
      "1 can", // tuna, 2 cans
      "1½ tbsp", // mascarpone, 3 tbsp
      "15 g", // parmesan, 30 g
      "1 tbsp", // capers, 2 tbsp
      "¼", // lemon, 0.5
      "½ bunch", // parsley, 1 bunch
    ]);
  });

  it("leaves to-taste items alone", () => {
    const toTaste: Ingredient = { item: "salt", qty: null, unit: null, aisle: "herbs-spices" };
    expect(scaledAmount(toTaste, 4, 2)).toBe("");
    expect(scaledAmount({ ...toTaste, unit: "pinch" }, 4, 2)).toBe("pinch");
  });

  it("scales gram totals, but not the notes text", () => {
    const can = tuna.ingredients[5];
    expect(gramsTotal(can, 4, 4)).toBe("220g total");
    expect(gramsTotal(can, 4, 2)).toBe("110g total");
    expect(gramsTotal(tuna.ingredients[0], 4, 2)).toBeUndefined();
    // "350g in step 2, 150g in step 3" is written for 4.
    expect(notesFor(tuna.ingredients[2], 4, 2)).toEqual({ text: "350g in step 2, 150g in step 3", forServes: 4 });
    expect(notesFor(tuna.ingredients[2], 4, 4)).toEqual({ text: "350g in step 2, 150g in step 3" });
    // A pack size next to a gram total: no "(for 4)".
    expect(notesFor(tuna.ingredients[5], 4, 2)).toEqual({ text: "110g cans" });
    // No amounts in it: no "(for 4)".
    expect(notesFor(tuna.ingredients[8], 4, 2)).toEqual({ text: "heaped" });
  });
});

describe("kitchenNumber", () => {
  it.each([
    [2, "2"],
    [0.5, "½"],
    [1.5, "1½"],
    [0.25, "¼"],
    [0.75, "¾"],
    [1 / 3, "⅓"],
    [2 / 3, "⅔"],
    [2.98, "3"],
    [1.4, "1.4"],
    [0.1, "0.1"],
    [0.02, "0.02"],
  ])("%s -> %s", (n, text) => {
    expect(kitchenNumber(n)).toBe(text);
  });
});

describe("formatAmount", () => {
  it("rounds grams and millilitres to whole numbers, small amounts to one place", () => {
    expect(formatAmount(333.33, "g")).toBe("333 g");
    expect(formatAmount(7.5, "ml")).toBe("7.5 ml");
  });

  it("keeps up to two decimals for kg and litres", () => {
    expect(formatAmount(1.125, "kg")).toBe("1.13 kg");
    expect(formatAmount(2, "l")).toBe("2 l");
    expect(formatAmount(0.25, "kg")).toBe("250 g");
  });

  it("makes countable units plural above one", () => {
    expect(formatAmount(2, "can")).toBe("2 cans");
    expect(formatAmount(1.5, "clove")).toBe("1½ cloves");
    expect(formatAmount(1, "pinch")).toBe("1 pinch");
    expect(formatAmount(3, "tbsp")).toBe("3 tbsp");
  });
});

describe("scaledBanner", () => {
  it("says how it was scaled", () => {
    expect(scaledBanner(4, 4)).toBeUndefined();
    expect(scaledBanner(4, 2)).toBe("Halved from 4 servings");
    expect(scaledBanner(2, 4)).toBe("Doubled from 2 servings");
    expect(scaledBanner(4, 3)).toBe("Scaled from 4 servings");
    expect(scaledBanner(1, 3)).toBe("Scaled from 1 serving");
  });
});

describe("groupIngredients", () => {
  it("puts ungrouped ingredients first, then groups in file order", () => {
    const groups = groupIngredients(tofoo.ingredients);
    expect(groups.map((g) => g.group)).toEqual([null, "char siu sauce"]);
    expect(groups[1].items[0].ingredient.item).toBe("hoisin sauce");
    expect(groups.flatMap((g) => g.items).length).toBe(tofoo.ingredients.length);
  });

  it("has no empty ungrouped list when everything is grouped", () => {
    const all: Ingredient[] = [{ item: "a", qty: 1, unit: null, aisle: "other", group: "x" }];
    expect(groupIngredients(all)).toEqual([{ group: "x", items: [{ ingredient: all[0], index: 0 }] }]);
  });
});
