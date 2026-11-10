CREATE TABLE "destination" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"place_key" text NOT NULL,
	"name" text NOT NULL,
	"country_code" char(2),
	"region" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"nights" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "destination_position_valid" CHECK ("destination"."position" >= 0),
	CONSTRAINT "destination_name_length" CHECK (char_length("destination"."name") between 1 and 200),
	CONSTRAINT "destination_place_key_length" CHECK (char_length("destination"."place_key") between 1 and 200),
	CONSTRAINT "destination_country_format" CHECK ("destination"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "destination_latitude_range" CHECK ("destination"."latitude" between -90 and 90),
	CONSTRAINT "destination_longitude_range" CHECK ("destination"."longitude" between -180 and 180),
	CONSTRAINT "destination_nights_range" CHECK ("destination"."nights" between 0 and 365)
);
--> statement-breakpoint
ALTER TABLE "destination" ADD CONSTRAINT "destination_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "destination_trip_id_position_idx" ON "destination" USING btree ("trip_id","position");