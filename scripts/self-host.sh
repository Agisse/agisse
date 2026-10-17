#!/bin/sh
# Deploy your own copy to your Cloudflare account (README "Self-host"). Safe to re-run for updates.
# Needs: `npx wrangler login`, and .env with DATABASE_URL, BETTER_AUTH_SECRET and SELF_HOST_DOMAIN
# (a domain on your Cloudflare account, or workers.dev for the free *.workers.dev address).
set -e
val() { grep "^$1=" .env | tail -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//'; }
for k in DATABASE_URL BETTER_AUTH_SECRET SELF_HOST_DOMAIN; do
  [ -n "$(val "$k")" ] || { echo "Set $k in .env first."; exit 1; }
done

npx wrangler r2 bucket create agisse-resumes-eu --jurisdiction eu || echo "Keeping the existing agisse-resumes-eu bucket."
npm run db:migrate
SELF_HOST_DOMAIN=$(val SELF_HOST_DOMAIN) npm run build

# Worker secrets only: build-time keys (SENTRY_AUTH_TOKEN, VITE_*) never leave this machine.
secrets=$(mktemp)
trap 'rm -f "$secrets"' EXIT
for k in DATABASE_URL BETTER_AUTH_SECRET OPENROUTER_API_KEY EXA_API_KEY ADZUNA_APP_ID ADZUNA_APP_KEY SENTRY_DSN ADMIN_EMAIL RESEND_API_KEY EMAIL_FROM GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET TURNSTILE_SECRET_KEY POSTHOG_PERSONAL_API_KEY POSTHOG_API_URL; do
  v=$(val "$k")
  if [ -n "$v" ]; then printf '%s=%s\n' "$k" "$v" >> "$secrets"; fi
done
npx wrangler deploy --secrets-file "$secrets"
echo "Deployed. Sign up on your copy, then follow README \"Become the admin\"."
