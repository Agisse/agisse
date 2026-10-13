#!/bin/sh
# Push secrets from .env to the deployed Worker. Required ones must be set; optional ones are pushed when present.
set -e
val() { grep "^$1=" .env | tail -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//'; }
for k in DATABASE_URL BETTER_AUTH_SECRET; do
  v=$(val "$k")
  [ -n "$v" ] || { echo "skip $k (not in .env, deployed value kept)"; continue; }
  printf '%s' "$v" | npx wrangler secret put "$k"
done
# Server AI key, people search, Sentry, admin account, Resend (mail), Google sign-in, Turnstile, group invite link.
for k in OPENROUTER_API_KEY EXA_API_KEY SENTRY_DSN ADMIN_EMAIL RESEND_API_KEY EMAIL_FROM GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET TURNSTILE_SECRET_KEY GROUP_INVITE; do
  v=$(val "$k")
  [ -n "$v" ] && printf '%s' "$v" | npx wrangler secret put "$k" || echo "skip $k (not in .env)"
done
