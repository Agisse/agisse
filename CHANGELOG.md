# Changelog

All notable changes to Agisse are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

Each version lists what changes for people using Agisse first. Changes that only matter to contributors or self-hosters go under **For contributors and self-hosters**, which the in-app "What's new" page leaves out.

## [Unreleased]

### Added

- How Agisse scores a job, in the docs (`/docs/methodology`): what the 1–5 score weighs, why below 4.0 means a long shot, how the feed is ordered, and what the scores can't know.
- The Hired Wall: got the job with Agisse's help? Share your story on GitHub, and choose whether your name, only the role, or only the count shows. A job at Offer links to it once, until you open or hide the link.
- What's new, in the account menu: the changes that matter to you, newest first. A blue dot on your avatar says when there's something you haven't seen.
- Download my data, in Profile next to Delete account: everything you saved in Agisse as one JSON file, also while your account is on the waitlist.
- Have an invite code, on the waitlist card: an invite that arrives after you signed up opens your account straight away. The whole invite link works too.

### Changed

- Your monthly AI allowance now goes about a third further: Agisse counts what the AI costs plus 50%, not plus 100%.
- Agisse opens a little faster: it now checks your session with one request instead of two in a row.
- The homepage is a little quieter: two links that repeated the button or menu next to them are gone.
- Today is a little quieter: no date under the greeting, no progress bar repeating "1 of 4 done", and no empty Coming up box when nothing else is due.
- The job feed loads up to four times faster, most of all with no field picked.
- An open role in the job feed no longer names its fields twice: they stay as tags under the description.
- The homepage and sign-in load less than half the code they used to: the rest of the app only downloads once you're signed in, alongside your account details instead of after them.
- Usage analytics load after the page has, instead of before it.
- The homepage and sign-in no longer download the app's sidebar and menus.
- The homepage's opening animation is now plain CSS, so the homepage downloads a quarter less code.
- Coming back to Agisse is quicker: your browser keeps the app's code for a year instead of checking every file again on each visit.
- No more Loading screen when Agisse opens: the homepage, the waitlist card or the app's layout shows at once, and your page fills in when your account answers.
- A job and its tailored CV open on their layout at once, with Back and the tabs ready, instead of a "Loading the posting…" line.
- A job's Prepare tab shows its Hiring rounds and Online test sections at once while your saved research loads, so nothing jumps when it arrives.
- Companies opens on its search form straight away, instead of drawing it folded and then opening it.
- Score my CV shows which résumé it checks in its final shape while yours loads, instead of a "Loading your résumé…" line. On a phone, that sentence no longer breaks into three narrow columns.
- Text you paste into Score my CV stays put when Agisse refreshes your data in the background, instead of being cleared. Offer compare keeps your offers on screen while your jobs refresh, and Companies loads without a "Loading…" line.
- Without any AI key, model features now say "Connect your AI key in Profile" instead of failing with a provider error, so a self-hosted copy can run on users' own keys alone.
- The feed's field labels now read "Operations & logistics" and "Policy & public sector", so supply-chain and public-sector graduates find their field.
- Until the feed provider has embedded a seeker's profile, the feed ranks roles by the words of their degree instead of scoring every role as a perfect fit. Roles without an embedding no longer count as a perfect fit either.
- An empty Contacted list now links to People's search and names the Mark contacted button, instead of only saying nobody is there yet.
- An account still on the waitlist opens Jobs on the free feed instead of the posting check, which only opens once the account is approved. Add a job stays hidden until then too, instead of offering checks that can't run yet. So do a feed role's Tailor my CV and the "Applied to it?" question, which also wait for approval.
- The job feed now has a daily limit per account: 200 pages (a page per filter change, search or Show more), and a list goes 20 pages deep. Plenty for looking; it keeps the hosted feed from being copied in bulk. The MCP server's `list_vacancies` counts against the same limit. Admins are exempt, and daily counts are deleted after 30 days.
- The privacy policy now lists the geocoding, map-tile and logo services your browser contacts, and that your own AI key sends requests straight to that provider. Umami is gone from it; Agisse doesn't use it.

### For contributors and self-hosters

- With `PUBLIC_LAUNCH=1`, the homepage footer links Docs, Methodology, the legal pages and GitHub; MCP and the browser extension stay one click away in the docs.
- With `PUBLIC_LAUNCH=1`, the homepage's questions become the ones a first-time visitor asks: how the score is made, whether it applies for you (and why not), cost and funding, where your data lives, who's behind it, AI clients, and what's open source.
- The README opens with what Agisse is today (the feed, the apply-or-skip score, warm intros, prep) instead of People alone, and no longer mentions a paid Pro plan. Short versions in Dutch, French, German, Spanish, Italian and Polish sit next to it; `scripts/readme-translations.check.ts` says which ones to update when the English intro changes.
- The README and `/docs/self-host` show both ways to self-host: on your computer with `npx github:Agisse/agisse` (Node 20+ or Bun, embedded Postgres), or on Cloudflare with `npm run self-host`, and what the first one lacks.
- Installing the `npx agisse` package takes 174 MB instead of 545 MB: front-end packages are `devDependencies` now, since Vite bundles them into the built app anyway.
- `npm pack` builds the `npx agisse` package: the built app, local mode as one file (`dist/agisse.mjs`) and the migrations, about 3.3 MB. Not on npm yet (#117).
- CI installs that package in an empty folder and checks `npx agisse` on Node and Bun: it starts, an account signs up, the feed loads (`scripts/npx-smoke.sh`).
- `npm run local -- import-feed` loads public Arbeitnow roles into local mode's database. Local mode refuses to open a data folder another Agisse process is using, and says when the feed is empty.
- `scripts/import-feed.ts` no longer fails when Arbeitnow lists the same role on two pages.
- `npm run local` runs Agisse on Node without Cloudflare: the same app on `http://localhost:3000`, with an embedded Postgres (PGlite) in `./agisse-data/`, or your Neon database when `DATABASE_URL` is set. The first step towards `npx agisse`.
- `docs/self-host-local.md`: the design for `npx agisse`, which will run Agisse on one computer with an embedded Postgres (PGlite), and the local stand-in for each Cloudflare binding. All migrations apply on PGlite as they are.
- Hashed build files (`/assets/*`, `/docs/assets/*`) are served without running the Worker, with their headers in `public/_headers`; a missing one is a 404 instead of the app's HTML. Self-hosted zones keep the Worker's http → https and www redirects for every other path.
- The admin guest list shows placeholder rows while accounts load, instead of a "Loading accounts…" line and filter counts of 0.
- `GOVERNANCE.md` describes Agisse as it is: a free, open-source project led by its founder, with no company or association behind it. The plan for a Belgian association is dropped.
- The README, `/docs/self-host` and `/docs/feed-contract` say plainly what's open and what isn't: all the code is AGPL; agisse.xyz's job data stays with the hosted service, and a self-hosted copy starts with an empty feed.
- Eval fixtures use made-up employers, universities and people. `scripts/fixtures.check.ts` fails when a committed fixture, result or the seed links outside `example.com`, or, with a dev database, names an employer from the feed.
- CI fails when the initial JS grows more than 10% over `scripts/bundle-budget.json`.
- `/admin` shows, under an account, how often it hit the feed's daily limit in the last 30 days (a count only).
- Performance baseline in the docs (`/docs/performance`) and `eval/results/perf-baseline.json`; `scripts/bundle-size.ts` measures the initial bundle, and API responses carry a `Server-Timing` header with database round trips.
- `/api/me` reads the profile row once instead of twice (10 → 9 database round trips), and `loadProfile` no longer fetches the stored résumé text it doesn't use.
- The feed's filter counts (`/api/vacancies/facets`) are the same for everyone, so they now come from the edge cache for 10 minutes: 7 → 2 database round trips. The route still needs a signed-in account.
- `PUBLIC_LAUNCH` (Worker var, `"0"` by default): `"1"` turns on the launch-day homepage, starting with an "Open source · Free · Made in Europe" line in the hero.
- CI on every pull request: build with typecheck, lint, and every `*.check.ts`.
- Security workflows: gitleaks on every pull request; CodeQL, OpenSSF Scorecard and dependency review once the repository is public.
- Issue forms for bugs, feature ideas and self-host help, and a pull request template.
- `npm run db:seed` fills a development database with synthetic companies, roles and a test student.
- A release workflow that attaches the browser extension zip to each GitHub release.
- `worker/index.check.ts` boots the Worker with only the required secrets and walks the main routes; with a development `DATABASE_URL` it signs up a synthetic user and removes it again.
- An architecture page in the docs.
- `npm run eval:feed` ranks the job feed for 12 synthetic graduate personas (nursing to logistics) and reports, per persona, how many roles pass their filters, how on-field the top 30 is and how many employers it shows. No model calls.
- A feed contract in the docs: the columns, values and open-role rule a feed provider writes, checked against the schema.
- A self-host page in the docs: configure, check locally, deploy with `npm run self-host`, become the admin, and what to expect from an empty job feed.
- `npm run self-host` deploys your own copy: R2 bucket, migrations, build and deploy, with `SELF_HOST_DOMAIN` in place of the agisse.xyz routes.
- A data-flow page in the docs: what Agisse stores, where, and which outside service sees what.
- `scripts/import-feed.ts`, a reference feed provider: it loads the early-career roles from Arbeitnow's public API into the job feed, so a self-hosted copy has a working feed. Run it daily from cron.
- Builds load the Sentry plugin only when `SENTRY_AUTH_TOKEN` is set; self-hosted builds contact no telemetry service by default.
- `OPENROUTER_API_KEY`, `EXA_API_KEY` and `SENTRY_DSN` are optional secrets now; only `DATABASE_URL` and `BETTER_AUTH_SECRET` are required to deploy.
- Emails go out from `EMAIL_FROM` when it is set, so a self-hosted copy can send through its own Resend domain. The default stays `hello@agisse.xyz`.
- With no open roles at all, the job feed says no feed is connected, offers "Add a job", and links the feed contract for whoever runs the copy. The filters and views it can't use are hidden.

[Unreleased]: https://github.com/Agisse/agisse/commits/main
