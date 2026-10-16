---
title: Self-host
description: Run your own copy of Agisse, on your computer with one command or on Cloudflare's free plan, with your own AI key or your users' keys.
---

# Self-host

Two ways to run your own copy. Both run the same app; only the setup differs.

The easiest: paste `Read https://agisse.xyz/agent.md and set up my own Agisse.` into Claude Code, Codex or Cursor, and it does the steps below with you.

- **On your computer:** one command, for trying it, a home server, or one student association.
- **On Cloudflare:** a public deploy on Cloudflare's free plan and a free [Neon](https://neon.tech) Postgres database.

## On your computer

You need Node 20 or later, or Bun.

```sh
npx agisse
```

Agisse runs on `http://localhost:3000` and keeps everything in `./agisse-data/`: the database (an embedded Postgres), uploaded CVs and a secret made on the first run. From a clone, `npm install && npm run build && npm run local` does the same.

- **AI:** each user connects their own key under Profile → AI. To give everyone the server's key, start it with `OPENROUTER_API_KEY` set. The other [optional keys](#optional-keys) work the same way, except the `VITE_*` ones, which are set when the app is built.
- **Jobs:** the feed starts empty. Stop Agisse, run `npx agisse import-feed` to load public roles from Arbeitnow, and start it again. Run it again to refresh.
- **Admin:** sign up, stop Agisse, run `npx agisse admin you@example.com` and start it again. You approve other accounts at `/admin`.
- **Settings:** `PORT` and `AGISSE_DATA` change the port and the folder. With `DATABASE_URL`, Agisse uses your Neon database instead of the embedded one.

What it lacks next to Cloudflare:

- no edge cache, so the feed's filter counts run their queries on every request;
- rate limits count per process and reset on restart;
- one Agisse per data folder;
- no email without `RESEND_API_KEY`: emails print to the console;
- backups are copies of `agisse-data/`, taken while Agisse is stopped.

## On Cloudflare

You need Node 24 (what CI uses), a Cloudflare account and a Neon database.

### 1. Configure

```sh
git clone https://github.com/Agisse/agisse.git && cd agisse
npm install
cp .env.example .env
```

Fill in `.env`:

- **Required:** `DATABASE_URL` (your Neon connection string), `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `SELF_HOST_DOMAIN` (a domain on your Cloudflare account, or `workers.dev` for the free `*.workers.dev` address). Leave `ADMIN_EMAIL` empty until step 4.
- **Optional:** the [optional keys](#optional-keys) below.

### 2. Check it locally

```sh
cp .env .dev.vars         # the Worker reads its secrets from .dev.vars in dev
npm run db:migrate        # creates the tables in DATABASE_URL
npx tsx --env-file=.env worker/index.check.ts
npm run dev               # http://localhost:5173
```

`worker/index.check.ts` boots the Worker with your keys, signs up a synthetic `@example.com` user, hits the main routes and deletes the user again. It stops at the first route that fails and names it.

### 3. Deploy

```sh
npx wrangler login
npm run self-host
```

`npm run self-host` creates the `agisse-resumes-eu` R2 bucket (EU jurisdiction), runs the migrations, builds for `SELF_HOST_DOMAIN` and deploys with the Worker secrets from `.env`. Build-time keys (`VITE_*`, `SENTRY_AUTH_TOKEN`) never leave your machine. Run it again to update.

The agisse.xyz routes in `wrangler.jsonc` stay untouched: `SELF_HOST_DOMAIN` replaces them at build time.

### 4. Become the admin

Sign up on your copy with your own email, then run this once in your database (for example the Neon SQL editor):

```sql
UPDATE "user" SET is_admin = true, access_status = 'approved' WHERE lower(email) = 'you@example.com';
```

Set `ADMIN_EMAIL` to the same address in `.env` and run `npm run self-host` again. You approve other accounts at `/admin`.

## Optional keys

Each key turns one feature on, and Agisse works without it.

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
| `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_API_URL` | Deleting an account also deletes its PostHog person and events |
| `VITE_LOGO_DEV_TOKEN` | Company logos (otherwise monograms) |

## Hosted or self-hosted?

Your copy has every feature the code has; agisse.xyz holds nothing back. What differs:

| | agisse.xyz | Your copy |
|---|---|---|
| Features | All | All: the same code |
| Job feed | The curated hosted feed | Empty until you add a provider or the Arbeitnow importer |
| AI | Free models on agisse.xyz's key, or your own key | Your server key, or each user's own |
| Setup | None: sign up | One command, or a Cloudflare deploy |
| Shared prep (interview questions, test reports) | From every student on agisse.xyz | From your own users |
| Your users' data | agisse.xyz is the controller | You are |

## The job feed

The code is open source (AGPL). The job data on agisse.xyz is not: it's collected and maintained by the hosted service. Your copy starts with an empty feed; fill it with your own provider by following the [feed contract](/feed-contract), or with the [Arbeitnow importer](/feed-contract#a-reference-provider). Everything else works without a feed: pasted postings, public ATS boards, the Arbeitnow feed, Adzuna, people search and prep. The Education tab works the same way: it starts empty, and a provider fills it by following the [education contract](/education-contract).

## Telemetry

Off by default. A self-hosted copy sends nothing to Agisse, Sentry or PostHog unless you set `SENTRY_DSN`, `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`, or `SENTRY_AUTH_TOKEN`. Your own keys send to your own accounts. See [Data flow](/data-flow) for which service sees what.

## Your users' data

If other people use your copy, you are the controller of their data under the GDPR, not Agisse. Your users' CVs and profiles live in your database and storage, and go to the AI provider and other services you configure. Write your own privacy policy: agisse.xyz's [privacy policy](/privacy) and [Data flow](/data-flow) show what the code does, but name agisse.xyz's processors and owner, not yours. You also keep your own [record of processing](/records-of-processing); agisse.xyz's can be a starting point. Running it only for yourself on your own computer is personal use, which the GDPR doesn't cover.

## Getting help

Ask in [GitHub Discussions](https://github.com/Agisse/agisse/discussions). Help comes from the community, on a best-effort basis, with no response times. Only the two ways above are supported.

## Name and logo

The code is AGPL-3.0. The name and logo are not covered by the license: if you offer your copy to others, rename it (see `TRADEMARK.md`).
