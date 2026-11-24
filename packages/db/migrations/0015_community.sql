CREATE TABLE "comment_like" (
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_like_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "community_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_profile_handle_format" CHECK ("community_profile"."handle" ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "follow" (
	"follower_id" text NOT NULL,
	"followee_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id"),
	CONSTRAINT "follow_not_self" CHECK ("follow"."follower_id" <> "follow"."followee_id")
);
--> statement-breakpoint
CREATE TABLE "mute" (
	"user_id" text NOT NULL,
	"muted_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mute_user_id_muted_id_pk" PRIMARY KEY("user_id","muted_id"),
	CONSTRAINT "mute_not_self" CHECK ("mute"."user_id" <> "mute"."muted_id")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"place_name" text,
	"place_country" char(2),
	"audience" text NOT NULL,
	"attachment" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "post_kind_valid" CHECK ("post"."kind" in ('moment', 'tip', 'route', 'visa', 'goal')),
	CONSTRAINT "post_audience_valid" CHECK ("post"."audience" in ('everyone', 'followers')),
	CONSTRAINT "post_body_length" CHECK ("post"."body" = btrim("post"."body") and char_length("post"."body") <= 500),
	CONSTRAINT "post_place_name_length" CHECK ("post"."place_name" is null or ("post"."place_name" = btrim("post"."place_name") and char_length("post"."place_name") between 1 and 120)),
	CONSTRAINT "post_place_country_format" CHECK ("post"."place_country" is null or "post"."place_country" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "post_comment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "post_comment_body_length" CHECK ("post_comment"."body" = btrim("post_comment"."body") and char_length("post_comment"."body") between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "post_like" (
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_like_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "post_report" (
	"post_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_report_post_id_reporter_id_pk" PRIMARY KEY("post_id","reporter_id"),
	CONSTRAINT "post_report_reason_valid" CHECK ("post_report"."reason" in ('spam', 'abuse', 'unsafe', 'other'))
);
--> statement-breakpoint
CREATE TABLE "post_save" (
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_save_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "comment_like" ADD CONSTRAINT "comment_like_comment_id_post_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_like" ADD CONSTRAINT "comment_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_profile" ADD CONSTRAINT "community_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_followee_id_user_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mute" ADD CONSTRAINT "mute_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mute" ADD CONSTRAINT "mute_muted_id_user_id_fk" FOREIGN KEY ("muted_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_like" ADD CONSTRAINT "post_like_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_like" ADD CONSTRAINT "post_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_report" ADD CONSTRAINT "post_report_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_report" ADD CONSTRAINT "post_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_save" ADD CONSTRAINT "post_save_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_save" ADD CONSTRAINT "post_save_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_profile_handle_key" ON "community_profile" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "follow_followee_id_idx" ON "follow" USING btree ("followee_id");--> statement-breakpoint
CREATE INDEX "post_author_id_idx" ON "post" USING btree ("author_id","id");--> statement-breakpoint
CREATE INDEX "post_created_at_idx" ON "post" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "post_comment_post_id_idx" ON "post_comment" USING btree ("post_id","id");--> statement-breakpoint
CREATE INDEX "post_comment_author_id_idx" ON "post_comment" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "post_like_user_id_idx" ON "post_like" USING btree ("user_id");