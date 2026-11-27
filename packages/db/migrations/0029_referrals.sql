CREATE TABLE "pass_credit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_trip_id" uuid,
	"used_at" timestamp with time zone,
	CONSTRAINT "pass_credit_ref_unique" UNIQUE("ref"),
	CONSTRAINT "pass_credit_reason_valid" CHECK ("pass_credit"."reason" in ('referral'))
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"referred_user_id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rewarded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referral_code" (
	"user_id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "pass_credit" ADD CONSTRAINT "pass_credit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_credit" ADD CONSTRAINT "pass_credit_used_trip_id_trip_id_fk" FOREIGN KEY ("used_trip_id") REFERENCES "public"."trip"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pass_credit_user_idx" ON "pass_credit" USING btree ("user_id");