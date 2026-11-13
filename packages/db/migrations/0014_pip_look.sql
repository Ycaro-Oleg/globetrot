ALTER TABLE "user_preference" ADD COLUMN "pip_hat" text DEFAULT 'straw' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "pip_outfit" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "pip_bag" text DEFAULT 'trolley' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "pip_bag_color" text DEFAULT 'amber' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "pip_name" text;--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_pip_hat_valid" CHECK ("user_preference"."pip_hat" in ('straw', 'helmet', 'cap', 'none'));--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_pip_outfit_valid" CHECK ("user_preference"."pip_outfit" in ('none', 'scarf', 'aloha', 'vest'));--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_pip_bag_valid" CHECK ("user_preference"."pip_bag" in ('trolley', 'backpack', 'vintage'));--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_pip_bag_color_valid" CHECK ("user_preference"."pip_bag_color" in ('amber', 'cyan', 'pink'));--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_pip_name_length" CHECK ("user_preference"."pip_name" is null or ("user_preference"."pip_name" = btrim("user_preference"."pip_name") and char_length("user_preference"."pip_name") between 1 and 16));