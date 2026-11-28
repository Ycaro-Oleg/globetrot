CREATE TABLE "interest_email_day" (
	"day" date PRIMARY KEY NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_list_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"locale" text NOT NULL,
	"source" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"referrer_domain" text,
	"landing_path" text,
	"internal" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_version" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirm_hash" text,
	"confirm_expires_at" timestamp with time zone,
	"sends_window_start" timestamp with time zone,
	"sends_in_window" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_list_entry_email_unique" UNIQUE("email"),
	CONSTRAINT "interest_list_entry_locale_valid" CHECK ("interest_list_entry"."locale" in ('en', 'pt-BR')),
	CONSTRAINT "interest_list_entry_source_valid" CHECK ("interest_list_entry"."source" in ('landing', 'itinerary')),
	CONSTRAINT "interest_list_entry_email_normal" CHECK ("interest_list_entry"."email" = lower(btrim("interest_list_entry"."email"))),
	CONSTRAINT "interest_list_entry_sends_valid" CHECK ("interest_list_entry"."sends_in_window" >= 0)
);
--> statement-breakpoint
CREATE TABLE "interest_list_suppression" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"unsubscribed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "interest_list_entry_pending_idx" ON "interest_list_entry" USING btree ("created_at") WHERE "interest_list_entry"."confirmed_at" is null;