CREATE TABLE "user_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"home_country" char(2),
	"nationality" char(2),
	"time_zone" text,
	"units" text DEFAULT 'metric' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preference_locale_valid" CHECK ("user_preference"."locale" in ('en', 'pt-BR')),
	CONSTRAINT "user_preference_currency_format" CHECK ("user_preference"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "user_preference_home_country_format" CHECK ("user_preference"."home_country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "user_preference_nationality_format" CHECK ("user_preference"."nationality" ~ '^[A-Z]{2}$'),
	CONSTRAINT "user_preference_units_valid" CHECK ("user_preference"."units" in ('metric', 'imperial'))
);
--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;