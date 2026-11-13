CREATE TABLE "ai_proposal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"request" text NOT NULL,
	"summary" text NOT NULL,
	"changes" jsonb NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"applied" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"undo" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "ai_proposal_status_valid" CHECK ("ai_proposal"."status" in ('proposed', 'applied', 'discarded', 'undone')),
	CONSTRAINT "ai_proposal_request_length" CHECK (char_length("ai_proposal"."request") between 1 and 500),
	CONSTRAINT "ai_proposal_changes_array" CHECK (jsonb_typeof("ai_proposal"."changes") = 'array')
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_tokens_positive" CHECK ("ai_usage"."input_tokens" >= 0 and "ai_usage"."output_tokens" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_proposal" ADD CONSTRAINT "ai_proposal_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposal" ADD CONSTRAINT "ai_proposal_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_proposal_trip_id_idx" ON "ai_proposal" USING btree ("trip_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_proposal_owner_id_idx" ON "ai_proposal" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage" USING btree ("user_id","created_at");