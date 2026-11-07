#!/usr/bin/env bash
# Spike #3: download (if missing) and import GeoNames into the local PostGIS (compose service `postgres`).
#   DATA_DIR=~/geonames-data spikes/places/import.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DATA_DIR=${DATA_DIR:-$HOME/geonames-data}
B=https://download.geonames.org/export/dump
mkdir -p "$DATA_DIR"
(
  cd "$DATA_DIR"
  for f in cities15000.zip admin1CodesASCII.txt countryInfo.txt alternateNamesV2.zip; do [ -f "$f" ] || curl -fsSLO "$B/$f"; done
  [ -f cities15000.txt ] || unzip -oq cities15000.zip
  [ -f alternateNamesV2.txt ] || unzip -oq alternateNamesV2.zip alternateNamesV2.txt
  grep -v '^#' countryInfo.txt > countries.tsv
  # Every real-language name (2-3 letter codes; skips pseudo-languages like link/post/iata) for our places only.
  if [ ! -f altnames-ours-all.tsv ]; then
    awk -F'\t' '
      FILENAME == ARGV[1] { ids[$1] = 1; next }
      FILENAME == ARGV[2] { ids[$4] = 1; next }
      FILENAME == ARGV[3] { ids[$17] = 1; next }
      ($2 in ids) && $3 ~ /^[a-z][a-z][a-z]?(-[A-Za-z][A-Za-z][A-Za-z]?[A-Za-z]?)?$/
    ' cities15000.txt admin1CodesASCII.txt countries.tsv alternateNamesV2.txt > altnames-ours-all.tsv
  fi
)
docker compose exec -T postgres mkdir -p /tmp/geonames
for f in cities15000.txt admin1CodesASCII.txt countries.tsv altnames-ours-all.tsv; do
  docker compose cp "$DATA_DIR/$f" "postgres:/tmp/geonames/$f" >/dev/null 2>&1
done
start=$(date +%s)
docker compose exec -T postgres psql -U "${POSTGRES_USER:-globetrot}" -d "${POSTGRES_DB:-globetrot}" -q < spikes/places/import.sql
echo "import wall time: $(( $(date +%s) - start )) s"
