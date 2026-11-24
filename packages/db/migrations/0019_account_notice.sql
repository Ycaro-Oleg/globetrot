CREATE TABLE "account_notice" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_notice_user_id_kind_pk" PRIMARY KEY("user_id","kind"),
	CONSTRAINT "account_notice_kind_valid" CHECK ("account_notice"."kind" in ('trial-ending', 'trial-ended'))
);
--> statement-breakpoint
ALTER TABLE "account_notice" ADD CONSTRAINT "account_notice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;