#!/bin/sh
# Push secrets from .env to the deployed Worker. Required ones must be set; optional ones are pushed when present.
set -e
val() { grep "^$1=" .env | tail -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//'; }
for k in DATABASE_URL EXA_API_KEY OPENROUTER_API_KEY BETTER_AUTH_SECRET SENTRY_DSN; do
  v=$(val "$k")
  [ -n "$v" ] || { echo "skip $k (not in .env, deployed value kept)"; continue; }
  printf '%s' "$v" | npx wrangler secret put "$k"
done
# Admin account, Resend (mail), Google sign-in, Turnstile, group invite link.
for k in ADMIN_EMAIL RESEND_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET TURNSTILE_SECRET_KEY GROUP_INVITE; do
  v=$(val "$k")
  [ -n "$v" ] && printf '%s' "$v" | npx wrangler secret put "$k" || echo "skip $k (not in .env)"
done
