CREATE TABLE "checklist_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"group" text NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_item_group_valid" CHECK ("checklist_item"."group" in ('documents', 'money', 'bookings', 'packing')),
	CONSTRAINT "checklist_item_label_length" CHECK ("checklist_item"."label" = btrim("checklist_item"."label") and char_length("checklist_item"."label") between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_item_trip_id_created_at_idx" ON "checklist_item" USING btree ("trip_id","created_at");