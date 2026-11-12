CREATE TABLE "visa" (
	"user_id" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"city" text NOT NULL,
	"stamped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visa_user_id_country_code_pk" PRIMARY KEY("user_id","country_code"),
	CONSTRAINT "visa_country_format" CHECK ("visa"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "visa_city_length" CHECK (char_length("visa"."city") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "destination" ADD COLUMN "visited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "destination" ADD COLUMN "spots" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "destination" ADD COLUMN "todos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "visa" ADD CONSTRAINT "visa_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination" ADD CONSTRAINT "destination_spots_array" CHECK (jsonb_typeof("destination"."spots") = 'array');--> statement-breakpoint
ALTER TABLE "destination" ADD CONSTRAINT "destination_todos_array" CHECK (jsonb_typeof("destination"."todos") = 'array');