#!/usr/bin/env bash
# Verifies the local services the apps depend on (pnpm services:check).
set -uo pipefail
cd "$(dirname "$0")/../.."

if [ -f .env ]; then set -a; . ./.env; set +a; fi
POSTGRES_USER=${POSTGRES_USER:-globetrot}
POSTGRES_DB=${POSTGRES_DB:-globetrot}
S3_BUCKET=${S3_BUCKET:-globetrot-media}
S3_PORT=${S3_PORT:-8333}
MAILPIT_UI_PORT=${MAILPIT_UI_PORT:-8025}

failures=0
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; failures=$((failures + 1)); }

echo "Postgres"
if docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
  ok "accepting connections"
  exts=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "select string_agg(extname, ',' order by extname) from pg_extension where extname in ('postgis','pg_trgm','unaccent')" 2>/dev/null)
  [ "$exts" = "pg_trgm,postgis,unaccent" ] && ok "extensions: $exts" || fail "extensions missing (got: '${exts}'). Run pnpm services:reset to re-run init scripts."
  search=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "select unaccent('São Paulo') ilike 'sao paulo' and similarity('kyoto','kioto') > 0.2" 2>/dev/null)
  [ "$search" = "t" ] && ok "accent-insensitive + trigram search works" || fail "search smoke query failed"
else
  fail "not reachable (is the stack up? pnpm services:up)"
fi

echo "Object storage (S3 on :$S3_PORT)"
if curl -fsS "http://localhost:$S3_PORT/healthz" >/dev/null 2>&1; then
  ok "S3 endpoint healthy"
  if docker compose exec -T storage sh -c 'echo s3.bucket.list | weed shell -master=storage:9333' 2>/dev/null | grep -q "$S3_BUCKET"; then
    ok "bucket '$S3_BUCKET' exists"
  else
    fail "bucket '$S3_BUCKET' missing (docker compose up storage-init)"
  fi
  # Signed S3 round trip with the .env credentials (curl ≥ 7.75 supports SigV4).
  if curl --help all 2>/dev/null | grep -q -- '--aws-sigv4'; then
    key="healthcheck/$(date +%s).txt"
    url="http://localhost:$S3_PORT/$S3_BUCKET/$key"
    auth=(--aws-sigv4 "aws:amz:${S3_REGION:-us-east-1}:s3" --user "${S3_ACCESS_KEY_ID:-globetrot-dev}:${S3_SECRET_ACCESS_KEY:-globetrot-dev-secret}")
    if curl -fsS "${auth[@]}" -X PUT --data-binary 'hello' "$url" >/dev/null 2>&1 \
      && [ "$(curl -fsS "${auth[@]}" "$url" 2>/dev/null)" = "hello" ] \
      && curl -fsS "${auth[@]}" -X DELETE "$url" >/dev/null 2>&1; then
      ok "signed PUT/GET/DELETE works with the .env credentials"
    else
      fail "signed S3 round trip failed (check S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)"
    fi
    status=$(curl -s -o /dev/null -w '%{http_code}' --aws-sigv4 "aws:amz:us-east-1:s3" --user "wrong:wrong" "$url")
    [ "$status" = "403" ] && ok "unauthenticated access is rejected (403)" || fail "wrong credentials returned HTTP $status (expected 403)"
  fi
else
  fail "not reachable on localhost:$S3_PORT"
fi

echo "Mailpit (UI on :$MAILPIT_UI_PORT)"
if curl -fsS "http://localhost:$MAILPIT_UI_PORT/api/v1/info" >/dev/null 2>&1; then
  ok "SMTP catcher ready: http://localhost:$MAILPIT_UI_PORT"
  subject="globetrot-healthcheck-$(date +%s)"
  printf 'Subject: %s\r\n\r\nLocal SMTP check.\r\n' "$subject" > /tmp/globetrot-mail-check.txt
  if curl -fsS "smtp://localhost:${SMTP_PORT:-1025}" --mail-from check@globetrot.local --mail-rcpt dev@globetrot.local \
    -T /tmp/globetrot-mail-check.txt >/dev/null 2>&1; then
    id=$(curl -fsS "http://localhost:$MAILPIT_UI_PORT/api/v1/search?query=subject:$subject" 2>/dev/null |
      grep -o '"ID":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$id" ]; then
      ok "SMTP delivery on :${SMTP_PORT:-1025} reaches Mailpit"
      curl -fsS -X DELETE -H 'Content-Type: application/json' -d "{\"IDs\":[\"$id\"]}" \
        "http://localhost:$MAILPIT_UI_PORT/api/v1/messages" >/dev/null 2>&1
    else
      fail "test email was sent but not found in Mailpit"
    fi
  else
    fail "could not send a test email to localhost:${SMTP_PORT:-1025}"
  fi
  rm -f /tmp/globetrot-mail-check.txt
else
  fail "not reachable on localhost:$MAILPIT_UI_PORT"
fi

echo
if [ "$failures" -eq 0 ]; then echo "All local services are ready."; else echo "$failures check(s) failed."; exit 1; fi
