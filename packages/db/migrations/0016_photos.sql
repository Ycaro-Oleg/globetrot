CREATE TABLE "media_asset" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_asset_content_type_valid" CHECK ("media_asset"."content_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "media_asset_byte_size_positive" CHECK ("media_asset"."byte_size" > 0),
	CONSTRAINT "media_asset_size_positive" CHECK ("media_asset"."width" > 0 and "media_asset"."height" > 0)
);
--> statement-breakpoint
ALTER TABLE "destination" ADD COLUMN "photos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "photos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_asset_owner_id_idx" ON "media_asset" USING btree ("owner_id","created_at");--> statement-breakpoint
ALTER TABLE "destination" ADD CONSTRAINT "destination_photos_array" CHECK (jsonb_typeof("destination"."photos") = 'array');--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_photos_array" CHECK (jsonb_typeof("post"."photos") = 'array');