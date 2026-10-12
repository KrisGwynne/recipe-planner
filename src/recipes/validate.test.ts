import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRecipe, problemsForClaude, validateRecipe, type Problem } from "./validate";

const text = (slug: string) => readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests break the file on purpose
const example = (slug: string): any => JSON.parse(text(slug));
const tuna = () => example("lemony-tuna-tomato-caper-pasta");
const tofoo = () => example("char-siu-tofoo-noodles");

function problems(value: unknown): Problem[] {
  const result = validateRecipe(value);
  if (result.ok || !("problems" in result)) throw new Error(`expected problems, got ${JSON.stringify(result)}`);
  return result.problems;
}

describe("valid files", () => {
  it.each(["lemony-tuna-tomato-caper-pasta", "char-siu-tofoo-noodles"])("%s passes, untouched", (slug) => {
    const result = parseRecipe(text(slug));
    expect(result).toEqual({ ok: true, recipe: JSON.parse(text(slug)) });
  });
});

describe("the import design's examples (screen E)", () => {
  it("an unknown unit", () => {
    const recipe = tuna();
    recipe.ingredients[0].unit = "glug";
    expect(problems(recipe)).toEqual([
      {
        title: 'Unknown unit "glug"',
        detail:
          "Ingredient 1 (olive oil) uses a unit the app doesn't know. Allowed: g, kg, ml, l, tsp, tbsp, cup, pinch, handful, bunch, can, jar, pack, clove, slice, sprig, sheet, piece, or none.",
        path: "ingredients[0].unit",
      },
    ]);
  });

  it("tuna under meat", () => {
    const recipe = tuna();
    recipe.proteins[0].category = "meat";
    expect(problems(recipe)).toEqual([
      { title: "Tuna is listed as meat", detail: '"tuna" is a fish item, so its category must be "fish".', path: "proteins[0]" },
    ]);
  });
});

describe("common mistakes", () => {
  it("a missing required field", () => {
    const recipe = tuna();
    delete recipe.serves;
    expect(problems(recipe)).toEqual([{ title: 'Missing "serves"', detail: 'The recipe needs "serves".', path: "serves" }]);
  });

  it("a missing field in an ingredient", () => {
    const recipe = tuna();
    delete recipe.ingredients[2].aisle;
    expect(problems(recipe)).toEqual([
      { title: 'Missing "aisle"', detail: 'Ingredient 3 (cherry tomatoes) needs "aisle".', path: "ingredients[2].aisle" },
    ]);
  });

  it("a bad enum value", () => {
    const recipe = tuna();
    recipe.cuisine = "italian-ish";
    expect(problems(recipe)).toEqual([
      expect.objectContaining({ title: 'Unknown cuisine "italian-ish"', path: "cuisine" }),
    ]);
    expect(problems(recipe)[0].detail).toMatch(/^The recipe uses a cuisine the app doesn't know\. Allowed: british, irish/);
  });

  it("a bad entry in a list of values", () => {
    const recipe = tuna();
    recipe.meal_type = ["dinner", "supper"];
    expect(problems(recipe)).toEqual([
      expect.objectContaining({ title: 'Unknown meal type "supper"', path: "meal_type[1]" }),
    ]);
  });

  it("a bad slug", () => {
    const recipe = tuna();
    recipe.id = "Lemony Tuna Pasta";
    expect(problems(recipe)).toEqual([
      {
        title: '"Lemony Tuna Pasta" isn\'t a valid id',
        detail:
          'The id is lowercase letters and numbers joined by single hyphens, e.g. "lemony-tuna-pasta". The app uses it to match the recipe when it\'s imported again.',
        path: "id",
      },
    ]);
  });

  it("an extra field", () => {
    const recipe = tuna();
    recipe.colour = "red";
    expect(problems(recipe)).toEqual([
      {
        title: 'Unexpected field "colour"',
        detail: 'The recipe has "colour", which isn\'t in the schema. Remove it, or check the spelling.',
        path: "colour",
      },
    ]);
  });

  it("an extra field in a nested object", () => {
    const recipe = tuna();
    recipe.nutrition_per_serving.calories = 672;
    expect(problems(recipe)).toEqual([
      expect.objectContaining({ title: 'Unexpected field "calories"', path: "nutrition_per_serving.calories" }),
    ]);
    expect(problems(recipe)[0].detail).toMatch(/^Nutrition has "calories"/);
  });

  it("a wrong schema_version", () => {
    const recipe = tuna();
    recipe.schema_version = 0;
    expect(problems(recipe)).toEqual([
      { title: '"schema_version" must be 1', detail: 'The recipe has 0 for "schema_version".', path: "schema_version" },
    ]);
  });

  it("a missing schema_version", () => {
    const recipe = tuna();
    delete recipe.schema_version;
    expect(problems(recipe)).toEqual([expect.objectContaining({ title: 'Missing "schema_version"' })]);
  });

  it("the wrong type", () => {
    const recipe = tuna();
    recipe.serves = "4";
    expect(problems(recipe)).toEqual([
      { title: '"serves" should be a whole number', detail: 'The recipe has "4" for "serves".', path: "serves" },
    ]);
  });

  it("a negative time", () => {
    const recipe = tuna();
    recipe.times.prep_mins = -5;
    expect(problems(recipe)).toEqual([
      { title: '"prep_mins" can\'t be negative', detail: 'Times has -5 for "prep_mins".', path: "times.prep_mins" },
    ]);
  });

  it("an empty list that needs entries", () => {
    const recipe = tuna();
    recipe.method = [];
    expect(problems(recipe)).toEqual([
      { title: '"method" is empty', detail: 'The recipe needs at least one entry in "method".', path: "method" },
    ]);
  });

  it("a value listed twice", () => {
    const recipe = tuna();
    recipe.dietary = ["nut-free", "nut-free"];
    expect(problems(recipe)).toEqual([
      { title: '"nut-free" is listed twice', detail: 'Each entry in "dietary" should appear once.', path: "dietary" },
    ]);
  });

  it("a step timer of 0", () => {
    const recipe = tuna();
    recipe.method[1].timer_mins = 0;
    expect(problems(recipe)).toEqual([
      expect.objectContaining({ title: '"timer_mins" must be more than 0', path: "method[1].timer_mins" }),
    ]);
    expect(problems(recipe)[0].detail).toMatch(/^Step 2 has 0/);
  });

  it("a bad url", () => {
    const recipe = tuna();
    recipe.source.url = "bbc good food";
    expect(problems(recipe)).toEqual([expect.objectContaining({ title: '"url" isn\'t a web address', path: "source.url" })]);
  });
});

describe("proteins", () => {
  it("an item that isn't in its category", () => {
    const recipe = tuna();
    recipe.proteins[0].item = "venison";
    recipe.proteins[0].category = "meat";
    expect(problems(recipe)).toEqual([
      {
        title: 'Unknown meat item "venison"',
        detail:
          "Protein 1 (venison) uses a meat item the app doesn't know. Allowed: chicken, turkey, duck, beef, pork, lamb, game, other.",
        path: "proteins[0].item",
      },
    ]);
  });

  it("an unknown category", () => {
    const recipe = tuna();
    recipe.proteins[0].category = "seafood";
    expect(problems(recipe)).toEqual([
      {
        title: 'Unknown protein category "seafood"',
        detail: 'Protein 1 (tuna) uses a category the app doesn\'t know. Allowed: "meat", "fish", "vegetarian".',
        path: "proteins[0].category",
      },
    ]);
  });

  it("a protein's other problems are explained normally", () => {
    const recipe = tuna();
    recipe.proteins[0].amount = "2 cans";
    expect(problems(recipe)).toEqual([
      expect.objectContaining({ title: 'Unexpected field "amount"', path: "proteins[0].amount" }),
    ]);
  });

  it("a protein in a variation", () => {
    const recipe = tuna();
    recipe.variations[0].proteins = [{ category: "vegetarian", item: "chicken" }];
    expect(problems(recipe)).toEqual([
      {
        title: "Chicken is listed as vegetarian",
        detail: '"chicken" is a meat item, so its category must be "meat".',
        path: "variations[0].proteins[0]",
      },
    ]);
  });
});

describe("carbs", () => {
  it('"none" mixed with other carbs', () => {
    const recipe = tofoo();
    recipe.carbs = ["none", "rice"];
    expect(problems(recipe)).toEqual([
      {
        title: '"none" is mixed with other carbs',
        detail: '"carbs" is either ["none"] or a list of carbs, not both. Remove "none" or the others.',
        path: "carbs",
      },
    ]);
  });

  it("an unknown carb", () => {
    const recipe = tofoo();
    recipe.carbs = ["noodles", "couscous"];
    expect(problems(recipe)).toEqual([expect.objectContaining({ title: 'Unknown carb "couscous"', path: "carbs[1]" })]);
  });

  it("no carbs at all", () => {
    const recipe = tofoo();
    recipe.carbs = [];
    expect(problems(recipe)).toEqual([expect.objectContaining({ title: '"carbs" is empty', path: "carbs" })]);
  });
});

describe("whole-file problems (screen I)", () => {
  it("broken JSON", () => {
    expect(parseRecipe('{"id": "x",')).toEqual({
      ok: false,
      fileProblem: expect.objectContaining({ title: "This file isn't valid JSON" }),
    });
  });

  it.each([[[]], ["a recipe"], [null], [42]])("not a recipe object: %j", (value) => {
    expect(validateRecipe(value)).toEqual({
      ok: false,
      fileProblem: expect.objectContaining({ title: "This isn't a recipe file" }),
    });
  });

  it("a newer schema version", () => {
    const recipe = tuna();
    recipe.schema_version = 2;
    expect(validateRecipe(recipe)).toEqual({
      ok: false,
      fileProblem: {
        title: "Made for a newer version of the app",
        detail:
          "This file says schema_version: 2; this app reads version 1. Check your Claude project is using the current schema.",
        path: "schema_version",
      },
    });
  });
});

describe("every problem at once, nothing changed", () => {
  it("reports each problem, and leaves the file as it was", () => {
    const recipe = tuna();
    recipe.ingredients[3].unit = "glug";
    recipe.proteins[0].category = "meat";
    recipe.difficulty = "tricky";
    delete recipe.name;
    const before = structuredClone(recipe);
    expect(problems(recipe).map((p) => p.path)).toEqual(
      expect.arrayContaining(["name", "difficulty", "proteins[0]", "ingredients[3].unit"]),
    );
    expect(problems(recipe)).toHaveLength(4);
    expect(recipe).toEqual(before);
  });

  it("doesn't coerce a number given as text", () => {
    const recipe = tuna();
    recipe.ingredients[0].qty = "2";
    expect(problems(recipe)).toEqual([expect.objectContaining({ path: "ingredients[0].qty" })]);
    expect(recipe.ingredients[0].qty).toBe("2");
  });
});

describe("problemsForClaude", () => {
  it("lists every problem with its path, ready to paste", () => {
    const message = problemsForClaude("smoked-mackerel-bake.json", [
      { title: 'Unknown unit "glug"', detail: "Ingredient 4 (olive oil) uses a unit the app doesn't know.", path: "ingredients[3].unit" },
      { title: "This file isn't valid JSON", detail: "Ask Claude for the whole file again.", path: "" },
    ]);
    expect(message).toBe(
      [
        'The recipe file "smoked-mackerel-bake.json" didn\'t import into Recipe planner. Please fix these problems, keeping to the schema, and give me the whole file again:',
        "",
        "1. Unknown unit \"glug\" (ingredients[3].unit): Ingredient 4 (olive oil) uses a unit the app doesn't know.",
        "2. This file isn't valid JSON: Ask Claude for the whole file again.",
      ].join("\n"),
    );
  });
});
