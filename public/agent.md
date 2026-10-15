# Set up your own Agisse

You are a coding agent helping someone run their own copy of Agisse, the open-source job-search copilot (https://github.com/Agisse/agisse, AGPL-3.0). Follow these steps in order. Ask the person before anything that needs their accounts, and never paste their keys anywhere but their own `.env`.

## 1. Ask one question

"Just for you on this computer, or a public site others can use?"

- **This computer** → step 2.
- **A public site** → step 3. It needs a free Cloudflare account and a free Neon Postgres database.

## 2. On this computer

Needs Node 20+ or Bun. Check with `node -v`.

```sh
npx github:Agisse/agisse
```

Agisse opens on http://localhost:3000 and keeps everything in `./agisse-data/`. Leave it running and tell the person to:

1. open http://localhost:3000 and sign up;
2. connect an AI key under Profile → AI (an OpenRouter key works best, and free models cost nothing).

The job feed starts empty. To load public roles from Arbeitnow, stop Agisse, run `npx github:Agisse/agisse import-feed`, then start it again.

Done. Tell the person how to start it again next time (the same `npx` command, in the same folder).

## 3. A public site on Cloudflare

Needs Node 24.

```sh
git clone https://github.com/Agisse/agisse.git && cd agisse
npm install
cp .env.example .env
```

Fill in `.env` with the person:

- `DATABASE_URL`: they create a free project at https://neon.tech and paste its connection string.
- `BETTER_AUTH_SECRET`: generate it with `openssl rand -base64 32`.
- `SELF_HOST_DOMAIN`: a domain on their Cloudflare account, or `workers.dev` for a free `*.workers.dev` address.
- Leave `ADMIN_EMAIL` empty for now. Every other key is optional; the table in `docs/self-host.md` says what each turns on.

Check it locally, then deploy:

```sh
cp .env .dev.vars
npm run db:migrate
npx tsx --env-file=.env worker/index.check.ts   # stops at the first failing route and names it
npx wrangler login                              # the person approves this in their browser
npm run self-host
```

Then make the person the admin:

1. They sign up on the deployed site with their own email.
2. Run this once in the Neon SQL editor, with their email:
   ```sql
   UPDATE "user" SET is_admin = true, access_status = 'approved' WHERE lower(email) = 'their@email';
   ```
3. Set `ADMIN_EMAIL` to the same address in `.env` and run `npm run self-host` again.

They approve other accounts at `/admin`. To update later: `git pull && npm run self-host`.

## Before you finish, tell the person

- The code is open, but agisse.xyz's job feed isn't: their copy starts with an empty feed (see `docs/feed-contract.md`).
- Nothing is sent to Agisse, Sentry or PostHog unless they set those keys.
- If other people use their copy, they are responsible for those users' data under the GDPR and need their own privacy policy (`docs/self-host.md`, "Your users' data").
- If they offer it to others, they should rename it: the name and logo aren't covered by the license (`TRADEMARK.md`).

Full guide: https://agisse.xyz/docs/self-host
