-- Spike #3: GeoNames → PostGIS places with localized (en/pt) names and fuzzy search.
-- Runs inside the local postgres container (files copied to /tmp/geonames by import.sh).
\timing on
\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS spike_places CASCADE;
CREATE SCHEMA spike_places;
SET search_path = spike_places, public;

-- ---------- staging (raw GeoNames TSV; QUOTE set to a byte that never appears = no quoting) ----------
CREATE UNLOGGED TABLE stg_city (
  geonameid bigint, name text, asciiname text, alternatenames text, latitude float8, longitude float8,
  feature_class text, feature_code text, country_code text, cc2 text, admin1 text, admin2 text, admin3 text,
  admin4 text, population bigint, elevation text, dem text, timezone text, modified text
);
CREATE UNLOGGED TABLE stg_admin1 (code text, name text, asciiname text, geonameid bigint);
CREATE UNLOGGED TABLE stg_country (
  iso text, iso3 text, iso_numeric text, fips text, name text, capital text, area text, population bigint,
  continent text, tld text, currency_code text, currency_name text, phone text, postal_format text,
  postal_regex text, languages text, geonameid bigint, neighbours text, equivalent_fips text
);
CREATE UNLOGGED TABLE stg_alt (
  id bigint, geonameid bigint, lang text, name text, is_preferred text, is_short text,
  is_colloquial text, is_historic text, valid_from text, valid_to text
);

COPY stg_city FROM '/tmp/geonames/cities15000.txt' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01', NULL '');
COPY stg_admin1 FROM '/tmp/geonames/admin1CodesASCII.txt' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01', NULL '');
COPY stg_country FROM '/tmp/geonames/countries.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01', NULL '');
COPY stg_alt FROM '/tmp/geonames/altnames-ours-all.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01', NULL '');

-- ---------- model ----------
CREATE TABLE place (
  id           bigint PRIMARY KEY,                 -- GeoNames id (stable external key)
  kind         text NOT NULL CHECK (kind IN ('country', 'region', 'city')),
  parent_id    bigint REFERENCES place (id),       -- city → region → country
  country_code char(2) NOT NULL,
  admin1_code  text,
  name         text NOT NULL,                      -- GeoNames primary name
  names        jsonb NOT NULL DEFAULT '{}',        -- {"en": "Munich", "pt": "Munique"}
  population   bigint NOT NULL DEFAULT 0,
  location     geography (Point, 4326)
);

-- One row per searchable name variant, normalized (lower + unaccent).
CREATE TABLE place_name (
  place_id bigint NOT NULL REFERENCES place (id) ON DELETE CASCADE,
  lang     text,                                   -- NULL = primary/ascii name
  name     text NOT NULL,
  norm     text NOT NULL,
  PRIMARY KEY (place_id, norm)
);

CREATE FUNCTION norm(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT lower(public.unaccent('public.unaccent', trim(t))) $$;

-- ---------- load ----------
INSERT INTO place (id, kind, parent_id, country_code, name, population)
SELECT c.geonameid, 'country', NULL, c.iso, c.name, coalesce(c.population, 0)
FROM stg_country c WHERE c.geonameid IS NOT NULL;

INSERT INTO place (id, kind, parent_id, country_code, admin1_code, name)
SELECT a.geonameid, 'region', p.id, split_part(a.code, '.', 1), split_part(a.code, '.', 2), a.name
FROM stg_admin1 a JOIN place p ON p.kind = 'country' AND p.country_code = split_part(a.code, '.', 1)
WHERE a.geonameid IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO place (id, kind, parent_id, country_code, admin1_code, name, population, location)
SELECT s.geonameid, 'city', coalesce(r.id, c.id), s.country_code, s.admin1, s.name, coalesce(s.population, 0),
       ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography
FROM stg_city s
JOIN place c ON c.kind = 'country' AND c.country_code = s.country_code
LEFT JOIN place r ON r.kind = 'region' AND r.country_code = s.country_code AND r.admin1_code = s.admin1
ON CONFLICT (id) DO NOTHING;

-- Best localized name per place and language: pt-BR beats pt; then preferred, then short, then shortest; never colloquial/historic.
WITH ranked AS (
  SELECT a.geonameid, CASE WHEN a.lang LIKE 'pt%' THEN 'pt' ELSE a.lang END AS lang, a.name,
         row_number() OVER (
           PARTITION BY a.geonameid, CASE WHEN a.lang LIKE 'pt%' THEN 'pt' ELSE a.lang END
           -- IS TRUE: empty flags load as NULL, and NULLs sort first under DESC.
           ORDER BY (a.lang = 'pt-BR') IS TRUE DESC, (a.is_preferred = '1') IS TRUE DESC, (a.is_short = '1') IS TRUE DESC,
                    length(a.name), a.id
         ) AS rn
  FROM stg_alt a
  JOIN place p ON p.id = a.geonameid
  WHERE coalesce(a.is_colloquial, '') <> '1' AND coalesce(a.is_historic, '') <> '1'
    AND a.lang IN ('en', 'pt', 'pt-BR')
    AND a.name !~ '^(https?://|[A-Z]{2,3}$)'      -- skip links and bare codes like "NYC"
)
UPDATE place p SET names = sub.names
FROM (SELECT geonameid, jsonb_object_agg(lang, name) AS names FROM ranked WHERE rn = 1 GROUP BY geonameid) sub
WHERE p.id = sub.geonameid;

-- Countries: use countryInfo's short English name ("Brazil"); production uses CLDR (Intl.DisplayNames) per locale.
UPDATE place SET names = names || jsonb_build_object('en', name) WHERE kind = 'country';

-- English falls back to the GeoNames primary name (which is usually the English exonym for big places).
UPDATE place SET names = names || jsonb_build_object('en', name) WHERE NOT names ? 'en';

-- Search variants: primary + ascii + every non-colloquial, non-historic name in ANY language ("Kioto", "München", "Moskva").
INSERT INTO place_name (place_id, lang, name, norm)
SELECT DISTINCT ON (place_id, norm(v.name)) place_id, v.lang, v.name, norm(v.name)
FROM (
  SELECT p.id AS place_id, NULL::text AS lang, p.name FROM place p
  UNION ALL SELECT s.geonameid, NULL, s.asciiname FROM stg_city s JOIN place p ON p.id = s.geonameid WHERE s.asciiname <> ''
  UNION ALL SELECT a.geonameid, CASE WHEN a.lang LIKE 'pt%' THEN 'pt' ELSE a.lang END, a.name
    FROM stg_alt a JOIN place p ON p.id = a.geonameid
    WHERE coalesce(a.is_colloquial, '') <> '1' AND coalesce(a.is_historic, '') <> '1'
      AND a.name !~ '^(https?://|[A-Z]{2,3}$)' AND length(a.name) <= 80
) v
WHERE v.name IS NOT NULL AND length(trim(v.name)) > 0;

-- ---------- indexes ----------
CREATE INDEX place_parent_idx ON place (parent_id);
CREATE INDEX place_country_kind_idx ON place (country_code, kind);
CREATE INDEX place_location_idx ON place USING gist (location);
CREATE INDEX place_name_prefix_idx ON place_name (norm text_pattern_ops);
CREATE INDEX place_name_trgm_idx ON place_name USING gin (norm gin_trgm_ops);

-- ---------- search ----------
-- Prefix matches first (exact > prefix), then typo-tolerant trigram matches; ties broken by population.
CREATE FUNCTION search(q text, loc text DEFAULT 'en', lim int DEFAULT 10)
RETURNS TABLE (id bigint, kind text, label text, region text, country text, population bigint, score int, sim real)
LANGUAGE sql STABLE AS $$
  WITH nq AS (SELECT spike_places.norm(q) AS v),
  prefix AS (
    SELECT n.place_id, max(CASE WHEN n.norm = nq.v THEN 3 ELSE 2 END) AS score, 1::real AS sim
    FROM spike_places.place_name n, nq
    WHERE n.norm LIKE replace(replace(nq.v, '%', '\%'), '_', '\_') || '%'
    GROUP BY n.place_id
  ),
  fuzzy AS (
    SELECT n.place_id, 1 AS score, max(similarity(n.norm, nq.v)) AS sim
    FROM spike_places.place_name n, nq
    WHERE length(nq.v) >= 4 AND n.norm % nq.v
      AND (SELECT count(*) FROM prefix) < lim
    GROUP BY n.place_id
  ),
  hits AS (
    SELECT place_id, max(score) AS score, max(sim) AS sim FROM (SELECT * FROM prefix UNION ALL SELECT * FROM fuzzy) u GROUP BY place_id
  )
  SELECT p.id, p.kind,
         coalesce(p.names ->> loc, p.names ->> 'en', p.name),
         coalesce(r.names ->> loc, r.names ->> 'en', r.name),
         coalesce(c.names ->> loc, c.names ->> 'en', c.name),
         p.population, h.score, h.sim
  FROM hits h
  JOIN spike_places.place p ON p.id = h.place_id
  LEFT JOIN spike_places.place r ON r.id = p.parent_id AND r.kind = 'region'
  LEFT JOIN spike_places.place c ON c.country_code = p.country_code AND c.kind = 'country'
  -- Same score: cities before countries before regions (avoids "Lisboa" city + district twins), then population.
  ORDER BY h.score DESC, h.sim DESC, CASE p.kind WHEN 'city' THEN 0 WHEN 'country' THEN 1 ELSE 2 END, p.population DESC
  LIMIT lim
$$;

DROP TABLE stg_city, stg_admin1, stg_country, stg_alt;
ANALYZE place;
ANALYZE place_name;

-- ---------- report ----------
SELECT kind, count(*) FROM place GROUP BY kind ORDER BY kind;
SELECT count(*) AS name_variants FROM place_name;
SELECT count(*) FILTER (WHERE names ? 'pt') AS with_pt, count(*) AS total FROM place;
SELECT count(*) AS cities_without_region FROM place WHERE kind = 'city' AND parent_id IN (SELECT id FROM place WHERE kind = 'country');
SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'spike_places' AND c.relkind IN ('r') ORDER BY pg_total_relation_size(c.oid) DESC;
SELECT pg_size_pretty(sum(pg_total_relation_size(c.oid))) AS schema_total
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'spike_places' AND c.relkind = 'r';
