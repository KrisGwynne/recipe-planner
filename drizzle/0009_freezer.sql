CREATE TABLE "freezer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"servings" double precision NOT NULL,
	"adjustment" double precision DEFAULT 0 NOT NULL,
	"frozen_on" date NOT NULL,
	"from_entry" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freezer_items_servings" CHECK ("freezer_items"."servings" > 0 and "freezer_items"."servings" <= 50 and "freezer_items"."servings" * 2 = round("freezer_items"."servings" * 2)),
	CONSTRAINT "freezer_items_adjustment" CHECK ("freezer_items"."adjustment" * 2 = round("freezer_items"."adjustment" * 2))
);
--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD COLUMN "from_freezer" uuid;--> statement-breakpoint
ALTER TABLE "freezer_items" ADD CONSTRAINT "freezer_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezer_items" ADD CONSTRAINT "freezer_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezer_items" ADD CONSTRAINT "freezer_items_from_entry_meal_plan_entries_id_fk" FOREIGN KEY ("from_entry") REFERENCES "public"."meal_plan_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezer_items" ADD CONSTRAINT "freezer_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freezer_items_household" ON "freezer_items" USING btree ("household_id","frozen_on");--> statement-breakpoint
CREATE UNIQUE INDEX "freezer_items_from_entry" ON "freezer_items" USING btree ("from_entry");--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_from_freezer_freezer_items_id_fk" FOREIGN KEY ("from_freezer") REFERENCES "public"."freezer_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_plan_entries_from_freezer" ON "meal_plan_entries" USING btree ("from_freezer");--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_one_source" CHECK ("meal_plan_entries"."leftovers_of" is null or "meal_plan_entries"."from_freezer" is null);