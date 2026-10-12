CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"slug" text NOT NULL,
	"schema_version" integer NOT NULL,
	"name" text NOT NULL,
	"cuisine" text NOT NULL,
	"difficulty" text NOT NULL,
	"serves" integer NOT NULL,
	"total_mins" integer NOT NULL,
	"carbs" text[] NOT NULL,
	"protein_type" text NOT NULL,
	"protein_items" text[] NOT NULL,
	"meal_type" text[] NOT NULL,
	"dietary" text[] NOT NULL,
	"spice_level" text NOT NULL,
	"has_veggie_option" boolean NOT NULL,
	"kcal" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"saturates_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"sugars_g" double precision NOT NULL,
	"fibre_g" double precision NOT NULL,
	"protein_g" double precision NOT NULL,
	"salt_g" double precision NOT NULL,
	"nutrition_source" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_title" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_household_slug" ON "recipes" USING btree ("household_id","slug");--> statement-breakpoint
CREATE INDEX "recipes_household_name" ON "recipes" USING btree ("household_id",lower("name"));