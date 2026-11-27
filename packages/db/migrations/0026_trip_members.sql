CREATE TABLE "trip_invite" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"role" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "trip_invite_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "trip_invite_role_valid" CHECK ("trip_invite"."role" in ('editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "trip_member" (
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_member_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id"),
	CONSTRAINT "trip_member_role_valid" CHECK ("trip_member"."role" in ('editor', 'viewer'))
);
--> statement-breakpoint
ALTER TABLE "trip_invite" ADD CONSTRAINT "trip_invite_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_invite" ADD CONSTRAINT "trip_invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_member" ADD CONSTRAINT "trip_member_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_member" ADD CONSTRAINT "trip_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_invite_trip_id_idx" ON "trip_invite" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_member_user_id_idx" ON "trip_member" USING btree ("user_id");