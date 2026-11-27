CREATE TABLE "inbound_address" (
	"user_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_address_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "inbound_address" ADD CONSTRAINT "inbound_address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;