CREATE TABLE "trip_share" (
	"slug" text PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"show_amounts" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_share_trip_id_unique" UNIQUE("trip_id"),
	CONSTRAINT "trip_share_slug_format" CHECK ("trip_share"."slug" ~ '^[A-Za-z0-9_-]{22}$')
);
--> statement-breakpoint
ALTER TABLE "trip_share" ADD CONSTRAINT "trip_share_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_share" ADD CONSTRAINT "trip_share_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;