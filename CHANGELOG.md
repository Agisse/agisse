# Changelog

All notable changes to Agisse are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

Each version lists what changes for people using Agisse first. Changes that only matter to contributors or self-hosters go under **For contributors and self-hosters**, which the in-app "What's new" page leaves out.

## [Unreleased]

### Added

- What's new, in the account menu: the changes that matter to you, newest first. A blue dot on your avatar says when there's something you haven't seen.
- Download my data, in Profile next to Delete account: everything you saved in Agisse as one JSON file, also while your account is on the waitlist.

### Changed

- Your monthly AI allowance now goes about a third further: Agisse counts what the AI costs plus 50%, not plus 100%.
- Agisse opens a little faster: it now checks your session with one request instead of two in a row.
- The homepage and sign-in load less than half the code they used to: the rest of the app only downloads once you're signed in, alongside your account details instead of after them.
- Usage analytics load after the page has, instead of before it.
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

### For contributors and self-hosters

- The README, `/docs/self-host` and `/docs/feed-contract` say plainly what's open and what isn't: all the code is AGPL; agisse.xyz's job data stays with the hosted service, and a self-hosted copy starts with an empty feed.
- Eval fixtures use made-up employers, universities and people. `scripts/fixtures.check.ts` fails when a committed fixture, result or the seed links outside `example.com`, or, with a dev database, names an employer from the feed.
- CI fails when the initial JS grows more than 10% over `scripts/bundle-budget.json`.
- Performance baseline in the docs (`/docs/performance`) and `eval/results/perf-baseline.json`; `scripts/bundle-size.ts` measures the initial bundle, and API responses carry a `Server-Timing` header with database round trips.
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
