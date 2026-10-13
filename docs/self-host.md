---
title: Self-host
description: Run your own copy of Agisse on Cloudflare's free plan and a free Neon database, with your own AI key or your users' keys.
---

# Self-host

Agisse runs on Cloudflare's free plan plus a free [Neon](https://neon.tech) Postgres database. You need Node 24 (what CI uses), a Cloudflare account and a Neon database.

## 1. Configure

```sh
git clone https://github.com/Agisse/agisse.git && cd agisse
npm install
cp .env.example .env
```

Fill in `.env`:

- **Required:** `DATABASE_URL` (your Neon connection string), `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `SELF_HOST_DOMAIN` (a domain on your Cloudflare account, or `workers.dev` for the free `*.workers.dev` address). Leave `ADMIN_EMAIL` empty until step 4.
- **Optional:** each key turns one feature on, and Agisse works without it.

| Key | Turns on |
|---|---|
| `OPENROUTER_API_KEY` | The server's AI key; free models cost nothing. Without it, each user connects their own key under Profile → AI |
| `EXA_API_KEY` | People search |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Job search by city, and more postings in the feed |
| `RESEND_API_KEY` | Emails (otherwise they are logged to the console) |
| `EMAIL_FROM` | Sender address for those emails, on a domain verified in Resend |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Sign in with Google |
| `TURNSTILE_SECRET_KEY` + `VITE_TURNSTILE_SITE_KEY` | Bot protection on sign-in |
| `SENTRY_DSN`, `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` | Error tracking and analytics |
| `VITE_LOGO_DEV_TOKEN` | Company logos (otherwise monograms) |

## 2. Check it locally

```sh
cp .env .dev.vars         # the Worker reads its secrets from .dev.vars in dev
npm run db:migrate        # creates the tables in DATABASE_URL
npx tsx --env-file=.env worker/index.check.ts
npm run dev               # http://localhost:5173
```

`worker/index.check.ts` boots the Worker with your keys, signs up a synthetic `@example.com` user, hits the main routes and deletes the user again. It stops at the first route that fails and names it.

## 3. Deploy

```sh
npx wrangler login
npm run self-host
```

`npm run self-host` creates the `agisse-resumes` R2 bucket, runs the migrations, builds for `SELF_HOST_DOMAIN` and deploys with the Worker secrets from `.env`. Build-time keys (`VITE_*`, `SENTRY_AUTH_TOKEN`) never leave your machine. Run it again to update.

The agisse.xyz routes in `wrangler.jsonc` stay untouched: `SELF_HOST_DOMAIN` replaces them at build time.

## 4. Become the admin

Sign up on your copy with your own email, then run this once in your database (for example the Neon SQL editor):

```sql
UPDATE "user" SET is_admin = true, access_status = 'approved' WHERE lower(email) = 'you@example.com';
```

Set `ADMIN_EMAIL` to the same address in `.env` and run `npm run self-host` again. You approve other accounts at `/admin`.

## The job feed

Your copy starts with an empty job feed. The feed shows what the `vacancy` table holds, and agisse.xyz fills it with its own provider, which is private. Write your own rows by following the [feed contract](/feed-contract). Everything else works without a feed: pasted postings, public ATS boards, the Arbeitnow feed, Adzuna, people search and prep.

## Telemetry

Off by default. A self-hosted copy sends nothing to Agisse, Sentry or PostHog unless you set `SENTRY_DSN`, `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`, or `SENTRY_AUTH_TOKEN`. Your own keys send to your own accounts. See [Data flow](/data-flow) for which service sees what.

## Name and logo

The code is AGPL-3.0. The name and logo are not covered by the license: if you offer your copy to others, rename it (see `TRADEMARK.md`).
