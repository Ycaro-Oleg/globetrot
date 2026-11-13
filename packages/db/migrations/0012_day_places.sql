CREATE TABLE "trip_place" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"destination_id" uuid,
	"name" text NOT NULL,
	"minutes" integer NOT NULL,
	"day" integer,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_place_name_length" CHECK ("trip_place"."name" = btrim("trip_place"."name") and char_length("trip_place"."name") between 1 and 120),
	CONSTRAINT "trip_place_minutes_range" CHECK ("trip_place"."minutes" between 15 and 720),
	CONSTRAINT "trip_place_day_positive" CHECK ("trip_place"."day" is null or "trip_place"."day" >= 1),
	CONSTRAINT "trip_place_position_not_negative" CHECK ("trip_place"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "trip_place" ADD CONSTRAINT "trip_place_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_place_trip_id_position_idx" ON "trip_place" USING btree ("trip_id","position");