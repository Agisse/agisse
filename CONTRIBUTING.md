# Contributing

Thanks for helping. Agisse is small on purpose: one clear action per view, AI only where it helps. Contributions that remove things are as welcome as ones that add them.

## First screen in 10 minutes

You need Node 24 (what CI uses) and a free [Neon](https://neon.tech) database (a new project or a branch; the app talks to Postgres through Neon's HTTP driver).

```sh
npm ci
cp .dev.vars.example .dev.vars   # fill in DATABASE_URL, BETTER_AUTH_SECRET and an OpenRouter key
cp .dev.vars .env                # the db:* scripts read .env
npm run db:migrate               # creates the tables
npm run db:seed                  # synthetic companies, open roles and a test student
npm run dev                      # http://localhost:5173
```

`db:seed` prints a password for `student@example.com`; sign in with it to see the feed and the tracker. Re-running it keeps existing rows.

## Before you start

- Bugs and small fixes: open a pull request directly.
- Anything bigger (a new feature, a new dependency, a schema change): open a Discussion first so we can agree on the shape before you write it.
- Security issues: never in public. See [SECURITY.md](SECURITY.md).

## Run it

See "Run locally" in the [README](README.md). Only `DATABASE_URL`, `BETTER_AUTH_SECRET` and one AI key are needed; every other service is optional.

## Pull requests

- Keep each PR to one change. Match the style of the code around it.
- Run `npm run build && npm run lint && npm run check` (CI runs the same on every PR).
- Schema changes: edit `worker/db/schema.ts`, then `npm run db:generate`, and commit the generated migration.

## Sign your commits (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/) instead of a CLA. You keep your copyright; you confirm you have the right to submit the code under the project's license (AGPL-3.0). Add a sign-off to every commit:

```sh
git commit -s -m "Your message"
```

This adds `Signed-off-by: Your Name <you@example.com>`. Unsigned commits can't be merged.
