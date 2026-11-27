CREATE TABLE "trip_person_money" (
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"share_bp" integer,
	"saved_minor" bigint DEFAULT 0 NOT NULL,
	"monthly_minor" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_person_money_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id"),
	CONSTRAINT "trip_person_money_share_range" CHECK ("trip_person_money"."share_bp" is null or "trip_person_money"."share_bp" between 0 and 10000),
	CONSTRAINT "trip_person_money_amounts" CHECK ("trip_person_money"."saved_minor" >= 0 and "trip_person_money"."monthly_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "paid_by" text;--> statement-breakpoint
ALTER TABLE "trip_person_money" ADD CONSTRAINT "trip_person_money_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_person_money" ADD CONSTRAINT "trip_person_money_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;