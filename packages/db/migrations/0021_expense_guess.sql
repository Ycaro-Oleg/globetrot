ALTER TABLE "expense" ADD COLUMN "guess" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_one_guess_per_trip" ON "expense" USING btree ("trip_id") WHERE "expense"."guess";--> statement-breakpoint
-- Earlier onboardings stored the rough guess as a plain cost: mark it (the oldest match per trip). Only development
-- data has any; production had no accounts yet.
UPDATE "expense" SET "guess" = true WHERE "id" IN (
	SELECT DISTINCT ON ("trip_id") "id" FROM "expense"
	WHERE "status" = 'estimate' AND "category" = 'other' AND "description" IN (
		'Whole-trip estimate', 'Estimativa da viagem inteira',
		'Rough trip estimate (onboarding)', 'Estimativa da viagem (onboarding)'
	)
	ORDER BY "trip_id", "created_at"
);
