CREATE TABLE "trip_pass" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"provider_ref" text NOT NULL,
	CONSTRAINT "trip_pass_provider_ref_unique" UNIQUE("provider_ref")
);
--> statement-breakpoint
ALTER TABLE "trip_pass" ADD CONSTRAINT "trip_pass_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_pass" ADD CONSTRAINT "trip_pass_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_pass_user_id_idx" ON "trip_pass" USING btree ("user_id");