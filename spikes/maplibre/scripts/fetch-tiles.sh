#!/usr/bin/env bash
# Extracts the OSM basemap tiles used by the spike from a Protomaps daily planet build (range requests only).
set -euo pipefail
cd "$(dirname "$0")/../public/tiles"
BUILD=${BUILD:-https://build.protomaps.com/20261107.pmtiles}
IMG=protomaps/go-pmtiles:v1.31.2
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/out" "$IMG" extract "$BUILD" /out/world-z5.pmtiles --maxzoom=5
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/out" "$IMG" extract "$BUILD" /out/japan-z10.pmtiles --bbox=128.5,30.0,146.0,45.8 --maxzoom=10
ls -la
