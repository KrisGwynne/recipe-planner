import { sql } from "drizzle-orm";
import { check, date, doublePrecision, index, integer, pgTable, text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { Slot } from "@/plans/plan";
import { users } from "./auth";
import { households } from "./households";
import { recipes } from "./recipes";

// Meal plans (PP-170, handover section 4; designs/meal-plans.html). A plan is
// a start date and a number of days; its entries are stored by day number,
// so moving the start date moves the whole plan. Limits match the design's
// steppers and are checked here too.
export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    days: integer("days").notNull().default(7),
    people: integer("people").notNull().default(2),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (plan) => [
    index("meal_plans_household_start").on(plan.householdId, plan.startDate),
    check("meal_plans_days", sql`${plan.days} between 1 and 14`),
    check("meal_plans_people", sql`${plan.people} between 1 and 12`),
  ],
);

// One recipe in one meal of one day. A meal can hold several recipes (a curry
// and a side), kept in the order they were added. Deleting the recipe or the
// plan deletes its entries.
//
// An entry is either a cook or leftovers (PP-180, designs/leftovers.html): a
// leftovers meal points at the earlier cook it eats from (`leftovers_of`), in
// the same plan or the plan before, and has the cook's recipe. Removing the
// cook removes its leftovers meals.
export const mealPlanEntries = pgTable(
  "meal_plan_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    slot: text("slot").$type<Slot>().notNull(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    portionsPerPerson: doublePrecision("portions_per_person").notNull().default(1),
    leftoversOf: uuid("leftovers_of").references((): AnyPgColumn => mealPlanEntries.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (entry) => [
    index("meal_plan_entries_plan_day").on(entry.planId, entry.dayIndex),
    index("meal_plan_entries_recipe").on(entry.recipeId),
    index("meal_plan_entries_leftovers_of").on(entry.leftoversOf),
    check("meal_plan_entries_leftovers_of", sql`${entry.leftoversOf} <> ${entry.id}`),
    check("meal_plan_entries_day_index", sql`${entry.dayIndex} between 0 and 13`),
    check("meal_plan_entries_slot", sql`${entry.slot} in ('breakfast', 'lunch', 'dinner', 'snack')`),
    // Halves from ½ to 4 (the entry sheet's stepper).
    check(
      "meal_plan_entries_portions",
      sql`${entry.portionsPerPerson} between 0.5 and 4 and ${entry.portionsPerPerson} * 2 = round(${entry.portionsPerPerson} * 2)`,
    ),
  ],
);
