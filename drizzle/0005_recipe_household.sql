CREATE TABLE "recipe_cooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"cooked_on" date NOT NULL,
	"cooked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_household_data" (
	"recipe_id" uuid PRIMARY KEY NOT NULL,
	"favourite" boolean DEFAULT false NOT NULL,
	"rating" integer,
	"notes" text,
	"notes_updated_by" text,
	"notes_updated_at" timestamp with time zone,
	CONSTRAINT "recipe_household_data_rating" CHECK ("recipe_household_data"."rating" between 1 and 5),
	CONSTRAINT "recipe_household_data_notes" CHECK (char_length("recipe_household_data"."notes") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "recipe_cooks" ADD CONSTRAINT "recipe_cooks_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_cooks" ADD CONSTRAINT "recipe_cooks_cooked_by_users_id_fk" FOREIGN KEY ("cooked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_household_data" ADD CONSTRAINT "recipe_household_data_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_household_data" ADD CONSTRAINT "recipe_household_data_notes_updated_by_users_id_fk" FOREIGN KEY ("notes_updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_cooks_recipe_day" ON "recipe_cooks" USING btree ("recipe_id","cooked_on");