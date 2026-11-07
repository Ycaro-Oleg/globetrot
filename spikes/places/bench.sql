-- Spike #3: search samples + latency benchmark (server-side, warm cache).
SET search_path = spike_places, public;
\pset pager off

\echo '--- samples (pt) ---'
SELECT q, label, region, country, score, round(sim::numeric, 2) AS sim
FROM unnest(ARRAY['tok', 'são p', 'lisb', 'londres', 'cidade do m', 'kioto', 'nova y', 'munique', 'japão', 'rio de j']) AS q,
     LATERAL (SELECT * FROM search(q, 'pt', 3)) s;

\echo '--- samples (en) ---'
SELECT q, label, region, country, score, round(sim::numeric, 2) AS sim
FROM unnest(ARRAY['tok', 'sao p', 'lisb', 'mexico c', 'kyoto', 'new y', 'munich', 'japan', 'floren', 'istanbul']) AS q,
     LATERAL (SELECT * FROM search(q, 'en', 3)) s;

\echo '--- latency: 44 queries x 2 locales x 25 runs ---'
CREATE TEMP TABLE bench (q text, loc text, ms numeric);
DO $$
DECLARE
  qs text[] := ARRAY['to','tok','tokyo','são p','sao paulo','lisb','lisboa','londres','lond','cidade do m','mexico',
                     'kioto','quioto','new y','nova i','nova york','munique','munich','rio de j','paris','par','bue',
                     'buenos aires','san','sa','istambul','istanb','seul','seoul','barcel','floren','florença','rom',
                     'roma','kyo','osa','hako','japan','japão','brasil','braz','reykjav','marrakesh','cusco'];
  q text; loc text; i int; t0 timestamptz;
BEGIN
  PERFORM * FROM search('warm', 'en', 10);
  FOREACH loc IN ARRAY ARRAY['en', 'pt'] LOOP
    FOREACH q IN ARRAY qs LOOP
      FOR i IN 1..25 LOOP
        t0 := clock_timestamp();
        PERFORM * FROM search(q, loc, 10);
        INSERT INTO bench VALUES (q, loc, extract(epoch FROM clock_timestamp() - t0) * 1000);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

SELECT count(*) AS runs,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)::numeric, 2) AS p50_ms,
       round(percentile_cont(0.95) WITHIN GROUP (ORDER BY ms)::numeric, 2) AS p95_ms,
       round(max(ms), 2) AS max_ms
FROM bench;

\echo '--- slowest queries (p95) ---'
SELECT q, loc, round(percentile_cont(0.95) WITHIN GROUP (ORDER BY ms)::numeric, 2) AS p95_ms
FROM bench GROUP BY q, loc ORDER BY p95_ms DESC LIMIT 8;

\echo '--- query plan for a 3-letter prefix ---'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY ON)
SELECT * FROM search('tok', 'pt', 10);
