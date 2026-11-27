CREATE TABLE "trip_stamp" (
	"trip_id" uuid NOT NULL,
	"milestone" text NOT NULL,
	"earned_on" date NOT NULL,
	CONSTRAINT "trip_stamp_trip_id_milestone_pk" PRIMARY KEY("trip_id","milestone"),
	CONSTRAINT "trip_stamp_milestone_valid" CHECK ("trip_stamp"."milestone" in ('dest', 'route', 'budget', 'saved', 'docs', 'stays', 'itin', 'check', 'ready'))
);
--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "copied_from_post_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_stamp" ADD CONSTRAINT "trip_stamp_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_owner_id_copied_from_post_id_idx" ON "trip" USING btree ("owner_id","copied_from_post_id");