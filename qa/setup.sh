#!/usr/bin/env bash
# One-shot local environment for the QA scripts in this folder:
# Postgres + schema, a production build, and the app on :3000 with the paywall
# off. Needs GEMINI_API_KEY in the environment for real-model runs
# (AI_PROVIDER defaults to gemini here); everything else is local.
set -euo pipefail
cd "$(dirname "$0")/.."

service postgresql start >/dev/null
su postgres -c "psql -tc \"select 1 from pg_roles where rolname='mise'\"" | grep -q 1 \
  || su postgres -c "psql -c \"create user mise with password 'mise' superuser;\""
su postgres -c "psql -tc \"select 1 from pg_database where datname='mise'\"" | grep -q 1 \
  || su postgres -c "createdb -O mise mise"
PGPASSWORD=mise psql -h localhost -U mise -d mise -q -f prisma/schema.sql 2>/dev/null

export DATABASE_URL="postgres://mise:mise@localhost:5432/mise?sslmode=disable"
export SESSION_SECRET="${SESSION_SECRET:-local-qa-secret-0123456789abcdef}"
export AI_PROVIDER="${AI_PROVIDER:-gemini}"
export SKIP_PAYWALL=1 APP_URL=http://localhost:3000

[ -d node_modules ] || npm install --no-audit --no-fund
npx next build >/dev/null
nohup npx next start -p 3000 > qa/server.log 2>&1 &
for _ in $(seq 1 30); do curl -sf -o /dev/null localhost:3000/ && break; sleep 1; done
echo "app up on :3000 (provider=$AI_PROVIDER); log: qa/server.log"
