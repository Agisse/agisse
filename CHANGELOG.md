# Changelog

All notable changes to Agisse are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

Each version lists what changes for people using Agisse first. Changes that only matter to contributors or self-hosters go under **For contributors and self-hosters**, which the in-app "What's new" page leaves out.

## [Unreleased]

### Added

- Under a tailored CV, a cover letter and the feedback on a rehearsed answer, one quiet line when they were written on free models: your own OpenRouter key gives sharper results. With starter credit left, neither these nor the job score say "free models" any more, because credit runs on a paid model.
- Profile shows what's left of a one-time starter credit, for example "€3.20 of your €5 starter credit left · then free models". The monthly budget meter shows once the credit is used up.
- Agisse next to career-ops, Simplify, Jobright, Teal, Huntr, Jobscan and LinkedIn Easy Apply, in the docs (`/docs/compare/`): one dated page each, written from their own public pages.
- How it's scored, next to a job's 1–5 score: one quiet link to the page that explains the score and its limits.
- How Agisse scores a job, in the docs (`/docs/methodology`): what the 1–5 score weighs, why below 4.0 means a long shot, how the feed is ordered, and what the scores can't know.
- The Hired Wall: got the job with Agisse's help? Share your story on GitHub, and choose whether your name, only the role, or only the count shows. A job at Offer links to it once, until you open or hide the link.
- What's new, in the account menu: the changes that matter to you, newest first. A blue dot on your avatar says when there's something you haven't seen.
- Download my data, in Profile next to Delete account: everything you saved in Agisse as one JSON file, also while your account is on the waitlist.
- Have an invite code, on the waitlist card: an invite that arrives after you signed up opens your account straight away. The whole invite link works too.

### Changed

- Signing out now clears your assistant chats from this browser, so the next person on a shared computer can't read them.
- Jobs opens sooner after sign-in: the app now fetches each other page on its first visit, instead of all of them up front.
- The assistant loads when you first hover, focus or open it, so Jobs and Home no longer wait for it after sign-in.
- The Prepare tab's online-test practice loads when you open that tab, so Jobs opens sooner after sign-in.
- The homepage shows its final heading on the first paint, instead of a small plain copy that the app then swaps for the big one.
- The homepage and sign-in paint sooner: they no longer download the signed-in app's styles (a third of the stylesheet).
- The homepage and sign-in paint sooner again: their stylesheet is about a third of its size, because it now holds only what those pages use.
- A one-time AI credit now works on its own: what it pays for no longer counts toward your monthly allowance or the daily free limit, and while credit is left the daily free limit doesn't apply.
- A waitlist account that hasn't been used for 12 months is now deleted, as the privacy policy says, with its CV and everything else.
- An account that hasn't been used for 24 months gets one email, and is deleted 30 days later unless you sign in.
- Download my data now includes the CV PDF you uploaded, inside the same file.
- Deleting your account also removes the connections you gave AI apps through MCP (their access tokens and your consent), which stayed behind before.
- Under a job's score, one quiet line says Agisse runs on free models and links to connecting your own OpenRouter key, which gives sharper results.
- Past the daily free limit, Profile says so and when it lifts, instead of showing this month's budget as used up.
- Where you add your CV, one line says what to leave out: your photo, date of birth and anything you wouldn't tell an employer.
- Deleting your account also clears what Agisse kept in that browser for it: your assistant chats, weekly goal and layout hints.
- Analytics know you by your account id only, never your name or email, and never record your screen. Error reports leave out what you typed or uploaded.
- Your contact details stay out of AI requests: email addresses, phone numbers, birth dates, street addresses and national ID numbers in your CV are swapped for placeholders before a model sees it, and put back in what it writes.
- Agisse's pages now tell your browser which scripts may run (a Content Security Policy), so a script slipped into a page doesn't run.
- Posting and contact links must be web links (`http` or `https`), from the app, the extension and MCP alike.
- A CV upload is stored only if the file really is a PDF (its first bytes), not just labelled as one.
- Scores and drafts never lean on your age, gender, nationality, religion, health or photo, even when your CV mentions them. Every prompt that scores you or writes for you now says so, and the methodology page explains it.
- Agisse's free AI now has a daily limit per account, so a busy day can't use it up for everyone. Past it, Agisse says so and points to connecting your own OpenRouter key, which has no Agisse limit.
- Agisse's own AI key now runs on free models only. For stronger models, connect your own OpenRouter key in Profile → AI.
- Your monthly AI allowance now goes about a third further: Agisse counts what the AI costs plus 50%, not plus 100%.
- Agisse opens a little faster: it now checks your session with one request instead of two in a row.
- The homepage is a little quieter: two links that repeated the button or menu next to them are gone.
- Today is a little quieter: no date under the greeting, no progress bar repeating "1 of 4 done", and no empty Coming up box when nothing else is due.
- Your invite link shows on Today once you've finished Get started, so a new account sees one thing to do.
- Setting up your account ends on your roles: after the last question, "See my roles" opens the feed your answers shaped, instead of one more screen asking where to start.
- Creating an account asks for three things, not four: the invite code field opens from "Have an invite code?" under the form, and stays open when you arrive with an invite link.
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
- The privacy policy now lists the geocoding, map-tile and logo services your browser contacts, and that your own AI key sends requests straight to that provider. Umami is gone from it, and Agisse's pages no longer load its script.

### Fixed

- When an AI call fails, the server's logs and error reports no longer quote the model's answer, its refusal, or the part of your text a provider flagged; they keep the provider's short error message.
- Without an email service set up, the server prints only an email's link, not who it was for or its subject; a failed send logs the email service's error name, not its message.
- The feedback on a rehearsed answer shows Situation, Task, Action and Result on one line again, instead of one tick per line.

### For contributors and self-hosters

- The README is distilled to the intro, self-hosting, development and links. The feature-by-feature reference, settings and costs moved to [docs/internals](docs/internals.md). `agisse.xyz/agent.md` lets a coding agent (Claude Code, Codex, Cursor) set up a copy from one prompt; the landing shows "Onboard your agent" behind `PUBLIC_LAUNCH`.
- Live switches: `GLOBAL_DAILY_USD_CAP`, `FREE_DAILY_ACTIONS`, `FREE_DAILY_ACTIONS_ALL` and `MONTHLY_BUDGET_EUR` can be changed through `/api/admin/settings` without a redeploy (a `setting` table; within a minute everywhere). Without a row, `wrangler.jsonc` stays in charge.
- In `/admin`, an account at the free daily AI limit (`FREE_DAILY_ACTIONS`) shows "Reset today's free limit": its count for today starts again, logged like credit, export and delete. The limit for everyone stays.
- In `/admin`, a folded "Recent actions" list shows the last 20 lines of the admin action log (who exported, deleted or gave credit to which account, and when). The daily job deletes lines older than 2 years.
- New var `APP_URL` (`wrangler.jsonc`; `SELF_HOST_DOMAIN` sets it, local mode uses `http://localhost:<port>`): the address in mail the daily cron sends. Together with `RESEND_API_KEY` it turns on the 24-month deletion of unused accounts; without either, nobody is warned and nobody is deleted.
- The homepage loads 10 kB (gzipped) less JavaScript: icons and Base UI code that only signed-in pages use no longer travel with it. `vite.config.ts`'s first-paint chunk now lists only our own files and lets the bundler add the package code they use.
- The `motion` dependency is gone: "Working…" and the assistant's "Reading this page…" use shadcn's CSS `shimmer` utility, which already shipped with the styles. The signed-in app loads 40 kB (gzipped) less.
- Live switches: `GLOBAL_DAILY_USD_CAP`, `FREE_DAILY_ACTIONS`, `FREE_DAILY_ACTIONS_ALL` and `MONTHLY_BUDGET_EUR` can be changed in `/admin` → Limits without a redeploy (a `setting` table; within a minute everywhere). Without a row, `wrangler.jsonc` stays in charge.
- Live switches: `GLOBAL_DAILY_USD_CAP`, `FREE_DAILY_ACTIONS`, `FREE_DAILY_ACTIONS_ALL`, `MONTHLY_BUDGET_EUR` and the feed's daily page cap `FEED_DAILY_PAGES` (now a `wrangler.jsonc` var, default 200) can be changed in `/admin` → Limits without a redeploy (a `setting` table; within a minute everywhere). Without a row, `wrangler.jsonc` stays in charge.
- In `/admin`, "Give credit…" adds a one-time AI credit to an account (up to €100 at a time), logged like export and delete.
- In `/admin`, a used invite that carried a credit shows how much of it the person who joined has spent.
- In `/admin`, an administrator's row shows how many people joined with their share link and how much of its credit they have spent.
- In `/admin`, an invite can expire after a number of days (optional, 1–365; migration `0038` adds `invite.expires_at`). An expired invite opens nothing and its row says Expired.
- Local mode (`npx agisse`, `npm run local`) uses the same model lists and budget numbers as Cloudflare, from `wrangler.jsonc`. Before, every AI button read "budget used up" there. Environment variables still override them.
- In `/admin`, an invite can carry a one-time AI credit (optional, up to €100), shown on its row, and an administrator sets the credit each friend gets through their share link.
- In `/admin`, an administrator can export or delete an account for a user who asks by email: the same file as Download my data and the same erasure as Delete account, each confirmed first and logged (who, what, when; no content).
- `/admin` says under its heading what everyone used today on the server's AI key: dollars spent against `GLOBAL_DAILY_USD_CAP` and free actions against `FREE_DAILY_ACTIONS_ALL`.
- A GDPR article 30 record of processing for agisse.xyz in the docs (`/docs/records-of-processing`), which self-hosters can use as a starting point for their own.
- The self-host guide says who is responsible for users' data on your copy (you, as the GDPR controller) and that you need your own privacy policy and record of processing.
- The Content Security Policy adds `form-action`: forms post only to Agisse itself and to Overleaf. `csp.check.ts` fails when a `<form action>` in `src/` points anywhere else.
- `/admin` shows per account how many AI actions it used this month, and how many of the last 30 days it reached the free daily limit (`FREE_DAILY_ACTIONS`). Counts only.
- CI checks that one account can't read, change or delete another's saved posting (`scripts/npx-smoke.sh`, two synthetic accounts).
- `SECURITY.md` has a runbook for a data breach: stop it, rotate keys, write it down, tell the Belgian DPA within 72 hours when required, and tell the people affected.
- With `PUBLIC_LAUNCH=1`, a founder's note (placeholders until launch day) takes the place of the paragraph under "A co-pilot, not an autopilot."
- With `PUBLIC_LAUNCH=1`, the homepage footer links the changelog (`CHANGELOG.md` on GitHub).
- With `PUBLIC_LAUNCH=1`, the homepage links the comparison pages: "See comparisons" under the co-pilot table, and Compare in the footer.
- With `PUBLIC_LAUNCH=1`, the homepage footer shows the GitHub star count and, once there are stories, how many people were hired with Agisse (`HIRED.md`). Read from GitHub once an hour; nothing shows while the repo is private or GitHub doesn't answer.
- `GOVERNANCE.md` describes the roles (participant, contributor after three merged PRs, reviewer or area owner by invitation), RFCs in Discussions for big changes, and that sponsors never steer the roadmap. `MAINTAINERS.md` lists who reviews what.
- With `PUBLIC_LAUNCH=1`, the homepage gets its launch headline and closing line, and one trust line under the button (free with your own AI key, open source, made in Europe) replaces the line above the headline and the beta line. The crawler copy of the headline in `index.html` follows.
- With `PUBLIC_LAUNCH=1`, the homepage footer links Docs, Methodology, the legal pages and GitHub; MCP and the browser extension stay one click away in the docs.
- With `PUBLIC_LAUNCH=1`, the homepage's questions become the ones a first-time visitor asks: how the score is made, whether it applies for you (and why not), cost and funding, where your data lives, who's behind it, AI clients, and what's open source.
- The README opens with what Agisse is today (the feed, the apply-or-skip score, warm intros, prep) instead of People alone, and no longer mentions a paid Pro plan. Short versions in Dutch, French, German, Spanish, Italian and Polish sit next to it; `scripts/readme-translations.check.ts` says which ones to update when the English intro changes.
- The README and `/docs/self-host` show both ways to self-host: on your computer with `npx github:Agisse/agisse` (Node 20+ or Bun, embedded Postgres), or on Cloudflare with `npm run self-host`, and what the first one lacks.
- Installing the `npx agisse` package takes 174 MB instead of 545 MB: front-end packages are `devDependencies` now, since Vite bundles them into the built app anyway.
- `publish.yml` publishes the `npx agisse` package to npm on a release tag, with provenance and no npm token. It stays off until the owner turns it on (#117).
- `npm pack` builds the `npx agisse` package: the built app, local mode as one file (`dist/agisse.mjs`) and the migrations, about 3.3 MB. Not on npm yet (#117).
- CI installs that package in an empty folder and checks `npx agisse` on Node and Bun: it starts, an account signs up, the feed loads (`scripts/npx-smoke.sh`).
- `npm run local -- admin you@example.com` makes that signed-up account the admin in local mode, where there's no SQL editor. Without `RESEND_API_KEY`, the console now shows each email's link too, so a password reset works on a server without mail.
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
- Sentry traces one request in ten instead of every one (errors are still all reported): about 6–11 ms less per request.
- The session guard passes on the user row it already reads: `/api/me` drops from 9 to 7 database round trips, and every route that checks the AI budget saves one.
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
