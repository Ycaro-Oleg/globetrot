ALTER TABLE "destination" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "destination" ADD COLUMN "leg_mode" text;--> statement-breakpoint
ALTER TABLE "destination" ADD CONSTRAINT "destination_note_length" CHECK (char_length("destination"."note") between 1 and 500);--> statement-breakpoint
ALTER TABLE "destination" ADD CONSTRAINT "destination_leg_mode_valid" CHECK ("destination"."leg_mode" in ('flight', 'train', 'bus', 'car', 'boat', 'walk', 'other'));