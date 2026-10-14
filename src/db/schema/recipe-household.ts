import { sql } from "drizzle-orm";
import { boolean, check, date, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { MAX_NOTES } from "@/recipes/household";
import { users } from "./auth";
import { recipes } from "./recipes";

// The household's own data about a recipe (PP-169, handover section 4):
// favourite, rating, notes and the days it was cooked, shared by everyone in
// the household. Kept apart from the imported file and keyed by the recipe's
// row id, which re-importing keeps, so a new version of the file never changes
// it. Deleting the recipe deletes it. Households are reached through the recipe.

// One row per recipe, made the first time anything is set.
export const recipeHouseholdData = pgTable(
  "recipe_household_data",
  {
    recipeId: uuid("recipe_id")
      .primaryKey()
      .references(() => recipes.id, { onDelete: "cascade" }),
    favourite: boolean("favourite").notNull().default(false),
    rating: integer("rating"),
    notes: text("notes"),
    notesUpdatedBy: text("notes_updated_by").references(() => users.id, { onDelete: "set null" }),
    notesUpdatedAt: timestamp("notes_updated_at", { mode: "date", withTimezone: true }),
  },
  (data) => [
    check("recipe_household_data_rating", sql`${data.rating} between 1 and 5`),
    check("recipe_household_data_notes", sql`char_length(${data.notes}) between 1 and ${sql.raw(String(MAX_NOTES))}`),
  ],
);

// A day the household cooked the recipe ("Cooked today"), at most once a day.
export const recipeCooks = pgTable(
  "recipe_cooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    cookedOn: date("cooked_on", { mode: "string" }).notNull(),
    cookedBy: text("cooked_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  // Also the index for a recipe's history.
  (cook) => [uniqueIndex("recipe_cooks_recipe_day").on(cook.recipeId, cook.cookedOn)],
);
