#!/bin/sh
# Installs a packed tarball (`npm pack`) in an empty folder and runs it the way `npx agisse` does:
# the server answers, a synthetic account signs up and loads the feed. CI runs it under Node and Bun.
# Usage: sh scripts/npx-smoke.sh agisse-0.0.0.tgz [node|bun]
set -e
tgz=$(realpath "$1")
runtime=${2:-node}
dir=$(mktemp -d)
trap 'kill "$pid" 2>/dev/null || true; rm -rf "$dir"' EXIT
cd "$dir"

if [ "$runtime" = bun ]; then
  bun init -y >/dev/null && bun add "$tgz" >/dev/null
  port=3918
  PORT=$port bun --bun ./node_modules/.bin/agisse > server.log 2>&1 &
else
  npm init -y >/dev/null && npm install --no-audit --no-fund "$tgz" >/dev/null
  # The bin npx would run, started directly so $! is the server itself and the trap stops it.
  port=3917
  PORT=$port ./node_modules/.bin/agisse > server.log 2>&1 &
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
[ "$(code -b "$jar" "$url/api/me")" = 200 ] || { cat server.log; echo "/api/me after sign-up is not 200"; exit 1; }
curl -sf -b "$jar" "$url/api/vacancies" | grep -q '"vacancies"' || { cat server.log; echo "/api/vacancies failed"; exit 1; }
[ "$(code "$url/")" = 200 ] || { echo "The app shell is not 200"; exit 1; }
echo "$runtime: npx agisse works ($(du -sh node_modules | cut -f1) installed)"
