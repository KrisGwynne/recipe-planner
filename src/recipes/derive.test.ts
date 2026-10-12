import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Protein, Recipe } from "@/types/recipe";
import {
  browsingCategory,
  deriveColumns,
  entryNutrition,
  hasVeggieOption,
  macroEnergySplit,
  proteinItems,
  proteinType,
  scaleQty,
  totalMins,
} from "./derive";

const example = (slug: string): Recipe =>
  JSON.parse(readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8"));
const tunaPasta = example("lemony-tuna-tomato-caper-pasta");
const tofooNoodles = example("char-siu-tofoo-noodles");

const chicken: Protein = { category: "meat", item: "chicken" };
const beef: Protein = { category: "meat", item: "beef" };
const prawns: Protein = { category: "fish", item: "prawns" };
const tofu: Protein = { category: "vegetarian", item: "tofu" };
const egg: Protein = { category: "vegetarian", item: "egg" };

describe("the two examples (handover section 5)", () => {
  it("tuna pasta: fish, with a veggie option", () => {
    const columns = deriveColumns(tunaPasta);
    expect(columns).toMatchObject({ proteinType: "fish", proteinItems: ["tuna"], hasVeggieOption: true, totalMins: 35 });
  });

  it("Tofoo noodles: vegetarian", () => {
    const columns = deriveColumns(tofooNoodles);
    expect(columns).toMatchObject({ proteinType: "vegetarian", proteinItems: ["tofu"], hasVeggieOption: true });
  });
});

describe("totalMins", () => {
  it("is prep + cook + wait", () => {
    expect(totalMins({ prep_mins: 10, cook_mins: 25, wait_mins: 120 })).toBe(155);
  });
});

describe("proteinType", () => {
  it.each([
    [[chicken, prawns], "meat-and-fish"],
    [[chicken, beef], "meat"],
    [[chicken, tofu], "meat"],
    [[prawns], "fish"],
    [[prawns, egg], "fish"],
    [[tofu, egg], "vegetarian"],
    [[], "vegetarian"],
  ] as const)("%j -> %s", (proteins, expected) => {
    expect(proteinType([...proteins])).toBe(expected);
  });
});

describe("proteinItems", () => {
  it("lists every item once, in order", () => {
    expect(proteinItems([chicken, prawns, { category: "meat", item: "chicken", detail: "thighs" }, tofu])).toEqual([
      "chicken",
      "prawns",
      "tofu",
    ]);
    expect(proteinItems([])).toEqual([]);
  });
});

describe("hasVeggieOption", () => {
  it("is true for a vegetarian recipe, with no variations", () => {
    expect(hasVeggieOption({ proteins: [tofu], variations: [] })).toBe(true);
    expect(hasVeggieOption({ proteins: [], variations: [] })).toBe(true);
  });

  it("is true when a variation's proteins have no meat or fish", () => {
    const variation = (proteins: Protein[]) => ({ name: "Veggie", description: "", proteins });
    expect(hasVeggieOption({ proteins: [chicken], variations: [variation([])] })).toBe(true);
    expect(hasVeggieOption({ proteins: [chicken], variations: [variation([tofu])] })).toBe(true);
  });

  it("is false when every variation still has meat or fish", () => {
    expect(
      hasVeggieOption({ proteins: [chicken], variations: [{ name: "Prawn", description: "", proteins: [prawns] }] }),
    ).toBe(false);
  });

  it("ignores a variation without a proteins list: it keeps the main recipe's", () => {
    expect(hasVeggieOption({ proteins: [chicken], variations: [{ name: "Spicier", description: "" }] })).toBe(false);
  });
});

describe("protein_type is not a dietary claim", () => {
  it("dietary comes only from the recipe's dietary array", () => {
    const columns = deriveColumns(tunaPasta);
    // The veggie variation doesn't make the recipe vegetarian.
    expect(columns.dietary).toEqual(["nut-free"]);
    // A recipe with no meat or fish protein but not marked vegetarian (chicken stock, say).
    const stock: Recipe = { ...tofooNoodles, dietary: ["dairy-free"] };
    expect(deriveColumns(stock)).toMatchObject({ proteinType: "vegetarian", dietary: ["dairy-free"] });
  });
});

describe("browsingCategory", () => {
  it("is Vegan only for vegetarian recipes marked vegan", () => {
    expect(browsingCategory("vegetarian", ["vegetarian", "vegan"])).toBe("vegan");
    expect(browsingCategory("vegetarian", ["vegetarian"])).toBe("vegetarian");
    expect(browsingCategory("vegetarian", [])).toBe("vegetarian");
    // Not possible from a valid file, but the rule only follows protein_type.
    expect(browsingCategory("fish", ["vegan"])).toBe("fish");
  });

  it("otherwise is the protein type", () => {
    expect(browsingCategory("meat", [])).toBe("meat");
    expect(browsingCategory("meat-and-fish", ["nut-free"])).toBe("meat-and-fish");
  });
});

describe("scaleQty", () => {
  it("scales by target / serves", () => {
    expect(scaleQty(400, 4, 2)).toBe(200);
    expect(scaleQty(0.5, 4, 6)).toBe(0.75);
    expect(scaleQty(3, 4, 4)).toBe(3);
  });

  it("leaves a null qty alone", () => {
    expect(scaleQty(null, 4, 8)).toBeNull();
  });
});

describe("entryNutrition", () => {
  it("multiplies every value by portions per person, keeping the source", () => {
    expect(entryNutrition(tunaPasta.nutrition_per_serving, 1.5)).toEqual({
      source: "printed",
      kcal: 1008,
      fat_g: 34.5,
      saturates_g: 13.5,
      carbs_g: 124.5,
      sugars_g: 18,
      fibre_g: 13.5,
      protein_g: 43.5,
      salt_g: 2.25,
    });
  });
});

describe("macroEnergySplit", () => {
  it("weights protein and carbs by 4 and fat by 9, as % of their sum", () => {
    // 29×4 = 116, 83×4 = 332, 23×9 = 207; sum 655.
    const split = macroEnergySplit(tunaPasta.nutrition_per_serving);
    expect(split.protein).toBeCloseTo((116 / 655) * 100);
    expect(split.carbs).toBeCloseTo((332 / 655) * 100);
    expect(split.fat).toBeCloseTo((207 / 655) * 100);
    expect(split.protein + split.carbs + split.fat).toBeCloseTo(100);
  });

  it("is all zero when there are no macros", () => {
    expect(macroEnergySplit({ protein_g: 0, carbs_g: 0, fat_g: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe("deriveColumns", () => {
  it("builds every extracted column from the recipe", () => {
    expect(deriveColumns(tunaPasta)).toEqual({
      slug: "lemony-tuna-tomato-caper-pasta",
      schemaVersion: 1,
      name: "Lemony tuna, tomato & caper one-pot pasta",
      cuisine: "italian",
      difficulty: "easy",
      serves: 4,
      totalMins: 35,
      carbs: ["pasta"],
      proteinType: "fish",
      proteinItems: ["tuna"],
      mealType: ["dinner"],
      dietary: ["nut-free"],
      spiceLevel: "none",
      hasVeggieOption: true,
      kcal: 672,
      fatG: 23,
      saturatesG: 9,
      carbsG: 83,
      sugarsG: 12,
      fibreG: 9,
      proteinG: 29,
      saltG: 1.5,
      nutritionSource: "printed",
      sourceKind: "magazine",
      sourceTitle: "BBC Good Food",
    });
  });
});
