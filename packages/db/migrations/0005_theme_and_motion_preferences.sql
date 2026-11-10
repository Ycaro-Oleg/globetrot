ALTER TABLE "user_preference" ADD COLUMN "theme" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "motion" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_theme_valid" CHECK ("user_preference"."theme" in ('day', 'red-eye', 'system'));--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_motion_valid" CHECK ("user_preference"."motion" in ('full', 'reduced'));