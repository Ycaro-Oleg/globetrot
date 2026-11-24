CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_ref_unique" UNIQUE("ref"),
	CONSTRAINT "credit_ledger_reason_valid" CHECK ("credit_ledger"."reason" in ('top-up', 'pip', 'grant')),
	CONSTRAINT "credit_ledger_delta_nonzero" CHECK ("credit_ledger"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"interval" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_provider_subscription_id_unique" UNIQUE("provider_subscription_id"),
	CONSTRAINT "subscription_plan_valid" CHECK ("subscription"."plan" in ('explorer', 'voyager')),
	CONSTRAINT "subscription_interval_valid" CHECK ("subscription"."interval" in ('month', 'year')),
	CONSTRAINT "subscription_status_valid" CHECK ("subscription"."status" in ('active', 'past_due', 'canceled'))
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_user_id_idx" ON "credit_ledger" USING btree ("user_id","created_at");