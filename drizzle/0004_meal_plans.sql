CREATE TABLE "meal_plan_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"slot" text NOT NULL,
	"recipe_id" uuid NOT NULL,
	"portions_per_person" double precision DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plan_entries_day_index" CHECK ("meal_plan_entries"."day_index" between 0 and 13),
	CONSTRAINT "meal_plan_entries_slot" CHECK ("meal_plan_entries"."slot" in ('breakfast', 'lunch', 'dinner', 'snack')),
	CONSTRAINT "meal_plan_entries_portions" CHECK ("meal_plan_entries"."portions_per_person" between 0.5 and 4 and "meal_plan_entries"."portions_per_person" * 2 = round("meal_plan_entries"."portions_per_person" * 2))
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"days" integer DEFAULT 7 NOT NULL,
	"people" integer DEFAULT 2 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_plans_days" CHECK ("meal_plans"."days" between 1 and 14),
	CONSTRAINT "meal_plans_people" CHECK ("meal_plans"."people" between 1 and 12)
);
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_plan_id_meal_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_plan_entries_plan_day" ON "meal_plan_entries" USING btree ("plan_id","day_index");--> statement-breakpoint
CREATE INDEX "meal_plan_entries_recipe" ON "meal_plan_entries" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "meal_plans_household_start" ON "meal_plans" USING btree ("household_id","start_date");