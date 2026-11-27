CREATE TABLE "miles_balance" (
	"user_id" text NOT NULL,
	"program" text NOT NULL,
	"balance" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "miles_balance_user_id_program_pk" PRIMARY KEY("user_id","program"),
	CONSTRAINT "miles_balance_program_valid" CHECK ("miles_balance"."program" in ('smiles', 'latam-pass', 'azul', 'livelo', 'esfera')),
	CONSTRAINT "miles_balance_positive" CHECK ("miles_balance"."balance" > 0)
);
--> statement-breakpoint
CREATE TABLE "trip_miles" (
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"program" text NOT NULL,
	"miles" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_miles_trip_id_user_id_program_pk" PRIMARY KEY("trip_id","user_id","program"),
	CONSTRAINT "trip_miles_program_valid" CHECK ("trip_miles"."program" in ('smiles', 'latam-pass', 'azul', 'livelo', 'esfera')),
	CONSTRAINT "trip_miles_positive" CHECK ("trip_miles"."miles" > 0)
);
--> statement-breakpoint
ALTER TABLE "miles_balance" ADD CONSTRAINT "miles_balance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_miles" ADD CONSTRAINT "trip_miles_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_miles" ADD CONSTRAINT "trip_miles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;