CREATE TABLE "savings_checkin" (
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"week" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_checkin_trip_id_user_id_week_pk" PRIMARY KEY("trip_id","user_id","week"),
	CONSTRAINT "savings_checkin_week_format" CHECK ("savings_checkin"."week" ~ '^[0-9]{4}-W[0-9]{2}$'),
	CONSTRAINT "savings_checkin_amount" CHECK ("savings_checkin"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "weekly_notice" (
	"user_id" text NOT NULL,
	"week" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_notice_user_id_week_pk" PRIMARY KEY("user_id","week")
);
--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "weekly_reminder" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "savings_checkin" ADD CONSTRAINT "savings_checkin_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_checkin" ADD CONSTRAINT "savings_checkin_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_notice" ADD CONSTRAINT "weekly_notice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "savings_checkin_user_idx" ON "savings_checkin" USING btree ("user_id","week");