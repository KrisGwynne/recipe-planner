import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Recipe } from "@/types/recipe";
import type { ProteinType } from "@/recipes/derive";
import { users } from "./auth";
import { households } from "./households";

// A household's recipes (PP-160, handover section 4). `data` is the imported
// file, untouched; every other recipe column is derived from it by
// deriveColumns (src/recipes/derive.ts). Enum-like values are text, not
// Postgres enums, since the schema can add values without a new version.
// Indexed only by household: filters run over one household's recipes.
export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Recipe>().notNull(),

    slug: text("slug").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    name: text("name").notNull(),
    cuisine: text("cuisine").$type<Recipe["cuisine"]>().notNull(),
    difficulty: text("difficulty").$type<Recipe["difficulty"]>().notNull(),
    serves: integer("serves").notNull(),
    totalMins: integer("total_mins").notNull(),
    carbs: text("carbs").array().notNull(),
    proteinType: text("protein_type").$type<ProteinType>().notNull(),
    proteinItems: text("protein_items").array().notNull(),
    mealType: text("meal_type").array().notNull(),
    dietary: text("dietary").array().notNull(),
    spiceLevel: text("spice_level").$type<Recipe["spice_level"]>().notNull(),
    hasVeggieOption: boolean("has_veggie_option").notNull(),
    kcal: doublePrecision("kcal").notNull(),
    fatG: doublePrecision("fat_g").notNull(),
    saturatesG: doublePrecision("saturates_g").notNull(),
    carbsG: doublePrecision("carbs_g").notNull(),
    sugarsG: doublePrecision("sugars_g").notNull(),
    fibreG: doublePrecision("fibre_g").notNull(),
    proteinG: doublePrecision("protein_g").notNull(),
    saltG: doublePrecision("salt_g").notNull(),
    nutritionSource: text("nutrition_source").$type<Recipe["nutrition_per_serving"]["source"]>().notNull(),
    sourceKind: text("source_kind").$type<Recipe["source"]["kind"]>().notNull(),
    sourceTitle: text("source_title").notNull(),

    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (recipe) => [
    uniqueIndex("recipes_household_slug").on(recipe.householdId, recipe.slug),
    // A to Z regardless of case, the library's default sort.
    index("recipes_household_name").on(recipe.householdId, sql`lower(${recipe.name})`),
  ],
);
