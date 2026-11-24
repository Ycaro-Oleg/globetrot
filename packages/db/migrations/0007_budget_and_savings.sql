CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"trip_amount_minor" bigint NOT NULL,
	"fx_rate" text,
	"fx_source" text,
	"fx_as_of" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_category_valid" CHECK ("expense"."category" in ('flights', 'stay', 'local_transport', 'intercity_transport', 'food', 'experiences', 'insurance', 'documents', 'taxes', 'shopping', 'buffer', 'other')),
	CONSTRAINT "expense_status_valid" CHECK ("expense"."status" in ('estimate', 'confirmed', 'paid', 'unknown')),
	CONSTRAINT "expense_description_length" CHECK ("expense"."description" = btrim("expense"."description") and char_length("expense"."description") between 1 and 120),
	CONSTRAINT "expense_amount_positive" CHECK ("expense"."amount_minor" > 0 and "expense"."trip_amount_minor" > 0),
	CONSTRAINT "expense_currency_format" CHECK ("expense"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "expense_fx_provenance" CHECK (("expense"."fx_rate" is null and "expense"."fx_source" is null and "expense"."fx_as_of" is null)
        or ("expense"."fx_rate" ~ '^[0-9]+(.[0-9]+)?$' and "expense"."fx_source" is not null and "expense"."fx_as_of" is not null))
);
--> statement-breakpoint
CREATE TABLE "trip_savings" (
	"trip_id" uuid PRIMARY KEY NOT NULL,
	"saved_minor" bigint DEFAULT 0 NOT NULL,
	"monthly_minor" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_savings_not_negative" CHECK ("trip_savings"."saved_minor" >= 0 and "trip_savings"."monthly_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_savings" ADD CONSTRAINT "trip_savings_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_trip_id_created_at_idx" ON "expense" USING btree ("trip_id","created_at");