// Generates src/types/recipe.ts from schema/recipe.schema.json.
// Run `npm run schema:types` after changing the schema; a test fails if the
// committed types are out of date.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const root = new URL("..", import.meta.url);
const schemaPath = new URL("schema/recipe.schema.json", root);
const outPath = new URL("src/types/recipe.ts", root);

// Type names for the schema's nested parts. Applied to a copy of the schema,
// so the contract file itself only changes when the contract does.
const typeNames = {
  source: "RecipeSource",
  times: "RecipeTimes",
  storage: "RecipeStorage",
  nutrition_per_serving: "Nutrition",
  "proteins.items": "Protein",
  "dietary.items": "DietaryFlag",
  "ingredients.items": "Ingredient",
  "method.items": "MethodStep",
  "variations.items": "Variation",
};

export async function generateRecipeTypes() {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  for (const [path, title] of Object.entries(typeNames)) {
    const [prop, items] = path.split(".");
    const node = schema.properties[prop];
    (items ? node.items : node).title = title;
  }
  return compile(schema, "Recipe", {
    bannerComment:
      "/* Generated from schema/recipe.schema.json by `npm run schema:types`. Do not edit. */",
    additionalProperties: false,
    // Plain arrays rather than tuples; the minimum lengths are enforced by Ajv.
    ignoreMinAndMaxItems: true,
    style: { singleQuote: false },
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(outPath, await generateRecipeTypes());
  console.log(`Wrote ${fileURLToPath(outPath)}`);
}
