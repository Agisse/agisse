#!/bin/sh
# Installs a packed tarball (`npm pack`) in an empty folder and runs it the way `npx agisse` does:
# the server answers, a synthetic account signs up and loads the feed, and a second one can't reach its records.
# CI runs it under Node and Bun.
# Usage: sh scripts/npx-smoke.sh agisse-<version>.tgz [node|bun]
set -e
tgz=$(realpath "$1")
runtime=${2:-node}
dir=$(mktemp -d)
trap 'kill "$pid" 2>/dev/null || true; rm -rf "$dir"' EXIT
cd "$dir"

if [ "$runtime" = bun ]; then
  bun init -y >/dev/null && bun add "$tgz" >/dev/null
  port=3918
  GROUP_INVITE=npx-smoke PORT=$port bun --bun ./node_modules/.bin/agisse > server.log 2>&1 &
else
  npm init -y >/dev/null && npm install --no-audit --no-fund "$tgz" >/dev/null
  # The bin npx would run, started directly so $! is the server itself and the trap stops it.
  port=3917
  GROUP_INVITE=npx-smoke PORT=$port ./node_modules/.bin/agisse > server.log 2>&1 &
fi
pid=$!

url=http://localhost:$port
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
i=0
until [ "$(code "$url/api/me")" = 401 ]; do
  i=$((i + 1))
  [ $i -lt 60 ] || { cat server.log; echo "No 401 from /api/me after 60 s"; exit 1; }
  sleep 1
done

jar=$dir/cookies
[ "$(code -c "$jar" -H "origin: $url" -H 'content-type: application/json' \
  -d '{"email":"npx-smoke@example.com","password":"npx-smoke-password","name":"Smoke"}' "$url/api/auth/sign-up/email")" = 200 ] ||
  { cat server.log; echo "Sign-up failed"; exit 1; }
# A number, not null: without wrangler.jsonc's vars every AI button reads "budget used up".
curl -sf -b "$jar" "$url/api/me" | grep -q '"limit":[0-9]' || { cat server.log; echo "/api/me has no budget limit"; exit 1; }
curl -sf -b "$jar" "$url/api/vacancies" | grep -q '"vacancies"' || { cat server.log; echo "/api/vacancies failed"; exit 1; }
[ "$(code "$url/")" = 200 ] || { echo "The app shell is not 200"; exit 1; }

# One account can't read, change or delete another's saved posting.
json() { curl -sf -b "$jar" -H "origin: $url" -H 'content-type: application/json' "$@"; }
job=$(json -d '{"url":"https://example.com/jobs/1","save":{"company":"Example Corp","role":"Analyst"}}' "$url/api/jobs" | sed 's/.*"job":{"id":"\([^"]*\)".*/\1/')
[ -n "$job" ] || { cat server.log; echo "Could not save a posting"; exit 1; }
other=$dir/other
[ "$(code -c "$other" -H "origin: $url" -H 'content-type: application/json' \
  -d '{"email":"npx-smoke-other@example.com","password":"npx-smoke-password","name":"Other"}' "$url/api/auth/sign-up/email")" = 200 ] ||
  { cat server.log; echo "Second sign-up failed"; exit 1; }
as_other() { code -b "$other" -H "origin: $url" -H 'content-type: application/json' "$@"; }
# An open account (GROUP_INVITE), so the routes below reach their ownership check instead of the trial guard.
[ "$(as_other -d '{"code":"npx-smoke"}' "$url/api/me/invite")" = 200 ] || { cat server.log; echo "Invite failed"; exit 1; }
[ "$(as_other "$url/api/jobs/$job")" = 404 ] || { echo "Another account can read a saved posting"; exit 1; }
[ "$(as_other -X PATCH -d '{"status":"applied"}' "$url/api/jobs/$job")" = 404 ] || { echo "Another account can change a saved posting"; exit 1; }
[ "$(as_other -X DELETE "$url/api/jobs/$job")" = 200 ] || { echo "Delete as another account didn't reach the route"; exit 1; }
json "$url/api/jobs/$job" >/dev/null || { echo "Another account deleted a saved posting"; exit 1; }
echo "$runtime: npx agisse works ($(du -sh node_modules | cut -f1) installed)"
