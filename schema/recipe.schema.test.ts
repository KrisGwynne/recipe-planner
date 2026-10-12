import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./recipe.schema.json";
import { generateRecipeTypes } from "../scripts/generate-types.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const examplesDir = new URL("../examples/", import.meta.url);
const readExample = (file: string) =>
  JSON.parse(readFileSync(new URL(file, examplesDir), "utf8"));
const exampleFiles = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));

describe("recipe.schema.json", () => {
  it.each(exampleFiles)("accepts examples/%s", (file) => {
    const recipe = readExample(file);
    expect(validate(recipe), JSON.stringify(validate.errors, null, 2)).toBe(true);
    expect(`${recipe.id}.json`).toBe(file);
  });

  it("rejects an ingredient with an unknown unit", () => {
    const recipe = readExample("lemony-tuna-tomato-caper-pasta.json");
    recipe.ingredients[0].unit = "glug";
    expect(validate(recipe)).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({ instancePath: "/ingredients/0/unit", keyword: "enum" }),
    );
  });

  it("rejects tuna filed under meat", () => {
    const recipe = readExample("lemony-tuna-tomato-caper-pasta.json");
    recipe.proteins[0].category = "meat";
    expect(validate(recipe)).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({ instancePath: "/proteins/0", keyword: "oneOf" }),
    );
  });

  it("rejects \"none\" mixed with another carb", () => {
    const recipe = readExample("char-siu-tofoo-noodles.json");
    recipe.carbs = ["none", "noodles"];
    expect(validate(recipe)).toBe(false);
  });
});

describe("src/types/recipe.ts", () => {
  it("is up to date with the schema (run `npm run schema:types`)", async () => {
    const committed = readFileSync(new URL("../src/types/recipe.ts", import.meta.url), "utf8");
    expect(committed).toBe(await generateRecipeTypes());
  });
});
