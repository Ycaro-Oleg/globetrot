-- Spike #3: are localized display names right for 30 well-known cities (pt-BR exonyms) and their English names?
SET search_path = spike_places, public;
\pset pager off

CREATE TEMP TABLE expected (geonameid bigint, en text, pt_br text);
INSERT INTO expected VALUES
  (2643743, 'London', 'Londres'),            (3530597, 'Mexico City', 'Cidade do México'),
  (5128581, 'New York City', 'Nova York'),   (2867714, 'Munich', 'Munique'),
  (2886242, 'Cologne', 'Colônia'),           (524901, 'Moscow', 'Moscou'),
  (1850147, 'Tokyo', 'Tóquio'),              (1816670, 'Beijing', 'Pequim'),
  (2660646, 'Geneva', 'Genebra'),            (3176959, 'Florence', 'Florença'),
  (3164603, 'Venice', 'Veneza'),             (3169070, 'Rome', 'Roma'),
  (2267057, 'Lisbon', 'Lisboa'),             (2510911, 'Seville', 'Sevilha'),
  (264371, 'Athens', 'Atenas'),              (3369157, 'Cape Town', 'Cidade do Cabo'),
  (756135, 'Warsaw', 'Varsóvia'),            (3067696, 'Prague', 'Praga'),
  (2761369, 'Vienna', 'Viena'),              (2800866, 'Brussels', 'Bruxelas'),
  (2618425, 'Copenhagen', 'Copenhague'),     (2673730, 'Stockholm', 'Estocolmo'),
  (2650225, 'Edinburgh', 'Edimburgo'),       (498817, 'Saint Petersburg', 'São Petersburgo'),
  (1857910, 'Kyoto', 'Quioto'),              (1835848, 'Seoul', 'Seul'),
  (745044, 'Istanbul', 'Istambul'),          (281184, 'Jerusalem', 'Jerusalém'),
  (3448439, 'São Paulo', 'São Paulo'),       (3435910, 'Buenos Aires', 'Buenos Aires');

SELECT e.en AS expected_en, p.names ->> 'en' AS got_en, e.pt_br AS expected_pt_br, p.names ->> 'pt' AS got_pt,
       CASE WHEN p.id IS NULL THEN 'MISSING'
            WHEN p.names ->> 'pt' = e.pt_br AND p.names ->> 'en' = e.en THEN 'ok'
            WHEN p.names ->> 'pt' = e.pt_br THEN 'en differs'
            ELSE 'pt differs' END AS verdict
FROM expected e LEFT JOIN place p ON p.id = e.geonameid
ORDER BY verdict DESC, e.en;

SELECT count(*) FILTER (WHERE p.names ->> 'pt' = e.pt_br) AS pt_ok,
       count(*) FILTER (WHERE p.names ->> 'en' = e.en) AS en_ok,
       count(*) AS total
FROM expected e LEFT JOIN place p ON p.id = e.geonameid;

\echo '--- do searches in either language find them? (top-1 city for the full pt-BR and en names) ---'
SELECT e.pt_br, (SELECT s.id FROM search(e.pt_br, 'pt', 1) s) = e.geonameid AS pt_top1,
       e.en, (SELECT s.id FROM search(e.en, 'en', 1) s) = e.geonameid AS en_top1
FROM expected e ORDER BY pt_top1, en_top1, e.en;
