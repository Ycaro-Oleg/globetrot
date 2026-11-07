-- Runs once, when the local database volume is first created (docker-entrypoint-initdb.d).
-- Production enables the same extensions through migrations (packages/db, M3).
CREATE EXTENSION IF NOT EXISTS postgis;   -- geography for places, pins and routes (ADR-0003)
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy place search
CREATE EXTENSION IF NOT EXISTS unaccent;  -- accent-insensitive search ("Sao Paulo" finds "São Paulo")
