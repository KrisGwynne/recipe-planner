CREATE TABLE "household_departures" (
	"user_id" text PRIMARY KEY NOT NULL,
	"household_name" text NOT NULL,
	"left_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household_departures" ADD CONSTRAINT "household_departures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;