-- Extensions the application relies on (ADR-0003, docs/architecture/data-model.md).
-- The local Docker init script enables the same ones for convenience; production relies on this migration.
-- postgis needs a superuser (or a pre-created extension): on a managed database, create it once by hand.
-- IF NOT EXISTS keeps this safe when an extension is already present.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
