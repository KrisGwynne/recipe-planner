import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Recipe } from "@/types/recipe";
import { attachment, exportFileName, recipesZip } from "./export";
import { recipeFileText } from "./file";
import { parseRecipe } from "./validate";

const example = (slug: string): Recipe =>
  JSON.parse(readFileSync(new URL(`../../examples/${slug}.json`, import.meta.url), "utf8"));
const tuna = example("lemony-tuna-tomato-caper-pasta");
const charSiu = example("char-siu-tofoo-noodles");

describe("recipesZip", () => {
  it("holds one valid file per recipe, named by its id, that reads back as the same recipe", () => {
    const files = unzipSync(recipesZip([charSiu, tuna]));
    expect(Object.keys(files).sort()).toEqual(["char-siu-tofoo-noodles.json", "lemony-tuna-tomato-caper-pasta.json"]);
    for (const recipe of [charSiu, tuna]) {
      const text = strFromU8(files[`${recipe.id}.json`]);
      expect(text).toBe(recipeFileText(recipe));
      const parsed = parseRecipe(text);
      expect(parsed).toEqual({ ok: true, recipe });
    }
  });

  it("makes an empty zip for no recipes", () => {
    expect(unzipSync(recipesZip([]))).toEqual({});
  });
});

describe("file names", () => {
  it("names the zip after the household and the day", () => {
    expect(exportFileName("The Gwynnes", "2026-10-17")).toBe("The Gwynnes recipes 2026-10-17.zip");
    expect(exportFileName('Kris/Sam: "home"', "2026-10-17")).toBe("KrisSam home recipes 2026-10-17.zip");
    expect(exportFileName("  ", "2026-10-17")).toBe("Recipes 2026-10-17.zip");
  });

  it("gives an ASCII fallback and the full name in the header", () => {
    expect(attachment("Café recipes 2026-10-17.zip")).toBe(
      `attachment; filename="Caf_ recipes 2026-10-17.zip"; filename*=UTF-8''Caf%C3%A9%20recipes%202026-10-17.zip`,
    );
  });
});
