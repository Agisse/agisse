# Agisse

Agisse finds the best people to contact at a target company for a specific role, explains why each one matters, shows what you have in common, and drafts the note you send yourself. It never sends messages, never sends connection requests, and never logs into LinkedIn.

Agisse is open source under the [AGPL-3.0](LICENSE). Use it free at [agisse.xyz](https://agisse.xyz) (bring your own AI key, or pay for Pro and use ours), or run your own copy: see [Self-host](#self-host).

## Stack

- **Client**: Vite + React 19, plain CSS with design tokens (`src/styles/`), [wouter](https://github.com/molefrog/wouter) for routing, [lucide-react](https://lucide.dev) icons, self-hosted Barlow / Barlow Condensed.
- **API**: Cloudflare Worker (`worker/`) with [Hono](https://hono.dev). The same Worker serves the built SPA as static assets.
- **Auth**: [Better Auth](https://better-auth.com), email + password, sessions in Postgres. Password hashing is WebCrypto PBKDF2 (100k iterations) so sign-up stays inside the Workers Free plan's 10 ms CPU budget.
- **Access approval**: New accounts can register and get one free try while they wait: a single search (one company, one role). They can also import a résumé (up to 3 reads). Everything else that calls a model (more rounds, notes) waits until the administrator approves them. The account matching the `ADMIN_EMAIL` secret is the sole administrator; it also needs `is_admin` set in the database (see [Self-host](#self-host)). It can review requests at `/admin`, decline them, and revoke approved access. Existing accounts were kept approved during the migration. Approval is checked against the database on every protected request, including active sessions. No approval email is sent, so applicants check their status by signing in.
- **Database**: Neon Postgres over the HTTP driver (`@neondatabase/serverless`) with Drizzle ORM. No Hyperdrive needed.
- **Discovery**: [Exa](https://exa.ai) `people` search (2–3 queries per search, ~$0.02). Free tier is $10/month.
- **Ranking / drafting**: one structured-output call through [OpenRouter](https://openrouter.ai) to a free model, with a fallback chain and runtime discovery of `:free` models. Every shared-ground claim the model makes is verified against the person's public text before it is shown.
- **Connection notes**: draft on demand using one identifying hook and one brief question, with shortened role names. Generated notes stay strictly below the account's 200/300-character cap (counted like the UI), with up to three corrective passes. Overlong notes or notes missing a final question mark fail without being saved; they are never truncated. Conflicting study dates/status should be omitted. Check: `npx tsx worker/lib/pipeline.check.ts`.
- **Résumé import**: the badge page accepts a PDF. Text extraction runs in the browser with [pdf.js](https://mozilla.github.io/pdf.js/) (lazy-loaded, ~130 kB gzipped) so the Worker never parses it and stays within its 10 ms CPU cap. The original PDF is streamed unparsed to R2 (`PUT /api/profile/resume`, bucket `agisse-resumes`, key `resumes/<userId>.pdf`, max 10 MB, replaced on re-upload). The text goes to `POST /api/profile/extract`, one structured model call that fills the badge fields (plus `skills` and a `background` paragraph) for the user to review and save. Charged to the monthly token budget.
- **Job board**: paste a job posting → one structured call (`worker/lib/jobs.ts`) scores it against the imported résumé text (`profile.resume_text`) or the badge fields. The model's score is taken as given, but the "do not apply below 4.0" verdict and the importance caps are enforced in code (`finalizeEvaluation`). The tailored CV and the cover letter are one call each, stored on the `job` row. `verifyCv` drops any employer, school or skill that is not in the source text, and the browser prints the CV to PDF. The CV page also exports it as LaTeX in a one-page investment-banking layout (`src/lib/latex.ts`), either as a `.tex` download or opened in Overleaf. Check: `npx tsx src/lib/latex.check.ts`. The prompts are adapted from [career-ops](https://github.com/career-ops-hq/career-ops) (MIT, © Santiago Fernández de Valderrama). Checks: `npx tsx worker/lib/jobs.check.ts`.
- **Application check**: on a posting, `POST /api/jobs/:id/check` proofreads the seeker's résumé (pasted, else the tailored CV, else the imported résumé) and cover letter (pasted, else the stored one) against the posting's requirements and ATS screening in one structured call on a paid model with reasoning (`OPENROUTER_CHECK_MODELS`, tried twice, then the usual chain; about $0.02 a check), with the imported résumé as the source of truth for facts. `finalizeCheck` drops any flagged line whose quote is not verbatim in that document, and keyword coverage is an exact-phrase match in code. Not stored. Check: `npx tsx worker/lib/jobs.check.ts`.
- **Open roles**: the Job board checks public Greenhouse, Lever, Ashby, Personio, Recruitee, Workable and SmartRecruiters boards directly in the browser from a company name and optional website. With optional Adzuna keys it can also search by role and city through a cached Worker route. Results already on the user's board open the existing evaluation; the rest can be evaluated in one click. Check: `npx tsx shared/listings.check.ts`.
- **Jobs for you**: a Job board tab that fetches Arbeitnow's free public feed in the browser, plus Adzuna for up to three European countries when its keys are set, and filters and ranks the results with `matchFeed` (`shared/listings.ts`): level from European title words, remote, minimum salary, the profile's skills and target industries. No model call. Dealbreakers are saved in `profile.jobFeed`. Check: `npx tsx shared/listings.check.ts`.
- **Answers & emails**: `POST /api/jobs/:id/answer` answers one application-form question from the CV and posting; `POST /api/jobs/:id/email` writes a follow-up or thank-you email; `POST /api/people/:id/email` a first email to a person. One call each (`draftEmail`, `answerQuestion` in `worker/lib/jobs.ts`), returned and never stored. The extension uses the answer route and `GET /api/jobs/:id?keywords=1` (posting keywords missing from the CV) with the session cookie.
- **Capture by link**: `POST /api/jobs` also takes `{ url }` without text. The Worker reads the page through Exa `contents` (charged with the evaluation) and refuses LinkedIn links with a 422.
- **Shared posting store**: every evaluated posting lands once in `posting`, keyed by its normalized link (tracking parameters dropped) or a hash of its text, with the seeker-independent half of the first evaluation (`facts`) and a `seen_count`. Pasting a posting already on your board returns that job with no call. A posting another user brought in skips the page read; the evaluation stays per seeker. The company's website goes into `company`. Check: `npx tsx worker/lib/jobs.check.ts`.
- **What is stored**: every Exa response (people, web, page reads, company search) goes into `exa_cache`, keyed by the exact request, and is served from there for 7 days. Rows are never deleted, so the table is also a corpus. Wikidata company facts live in `company` and are re-asked after 30 days. A hit costs nothing. The browser extension (`extension/`) sends the active tab's selection or text to the Jobs form, which the user then evaluates.
- **Assessment prep**: per posting, `POST /api/jobs/:id/assessment/research` runs two Exa web searches and one structured call (`worker/lib/assessments.ts`) to find which online assessment the company uses. Results go into the shared `assessment_intel` table; the most specific row wins (role pattern, then location, then newest `source_date`). Code drops any source URL that was not in the search results, caps confidence by source kind, and keeps drills empty without evidence of a game-based test. Users file "the process changed" reports (`assessment_report`), and the UI shows them next to the intel. Training sessions (`training_session`) are free and unmetered. Benchmarks show a percentile only once `BENCHMARK_MIN_USERS` real users have trained a skill in the last 7 days. Checks: `npx tsx worker/lib/assessments.check.ts`.
- **Selection process**: per posting, `POST /api/jobs/:id/selection/research` runs four Exa web searches: interview reviews (Glassdoor, Indeed, Blind, public pages only), forums (Reddit, Wall Street Oasis, Blind), the company's careers pages, and prep or university pages. Searches are served from `exa_cache` for a week. One structured call (`worker/lib/selection.ts`) turns them into rounds, reported questions, advice and pitfalls. Rows go into the shared `selection_intel` table and are picked with the same `bestMatch` as assessments. Code drops every claim whose URL was not a search result and caps confidence by source kind. Checks: `npx tsx worker/lib/selection.check.ts`.
- **Interview practice**: each reported question on the Selection process tab has a Practice toggle. `POST /api/jobs/:id/answer-feedback` makes one structured call (`worker/lib/interview.ts`) with the posting and the résumé or badge text, returning STAR ticks, strengths, gaps and a tighter version that may only use facts from the answer or profile. Each attempt is stored in `practice_answer` and shown again on the question; the identical answer is served from there without a call.
- **Offer brief**: when a posting's status is Offer, `POST /api/jobs/:id/offer-brief` searches levels.fyi, Glassdoor and PayScale (an open search follows when that finds fewer than 2 results), then one structured call writes a salary range, levers and a script. `finalizeOfferBrief` nulls a range whose URL was not a search result and keeps only search-result sources. Stored in `job.offer_brief`. Checks: `npx tsx worker/lib/interview.check.ts`.
- **Board** (`/board`): postings in one column per status, moved by drag-and-drop or a select (`PATCH /api/jobs/:id`), each card listing the contacts at that company. A "Today" strip lists people due a follow-up and applications silent for 14 days (`dueItems` in `src/lib/followup.ts`); the nav shows the count from `GET /api/due`. Contacts met outside Agisse are added on Visited (`POST /api/people`, stored with no search). Check: `npx tsx src/lib/followup.check.ts`.
- **Scout** (`/scout`): find companies worth targeting from up to 5 dream companies and/or a description, filtered by location, size, the user's badge and an exclude list. `POST /api/scouts` runs one Exa `company` search per dream company plus one for the description, checks every candidate against [Wikidata](https://www.wikidata.org) in one SPARQL query (official website → industry, country, headcount, founding year; dissolved companies and wrong-size ones are dropped), then makes one structured call (`worker/lib/companies.ts`) that curates up to 15 picks in clusters with a reason each. The model may add up to 5 companies from its own knowledge; they are checked against Wikidata and flagged "model suggestion · verify" when nothing confirms them. `finalizeScout` drops any "search" pick that was never found. Scouts (`scout`) and the shortlist (`saved_company`) persist; "Open booth" hands a company to the Map. Charged to the monthly budget. Checks: `npx tsx worker/lib/companies.check.ts`.

## Getting better over time

Each piece below feeds the next:

- **Generation log**
  - Every model call records its task (schema name), the model that answered, the models that failed first, the prompt version and the raw output in `usage`.
    - The prompt version is the first 8 hex characters of a SHA-256 over the system prompt.
  - It also records what the code verifiers had to drop (`flags`).
  - `charge()` writes it from the `Meter`; routes set `meter.ref` to the job, person or search.
  - Edited notes and letters set `person.outreach_edited` / `job.cover_edited`; the draft itself stays in `usage.output`.
- **Thumbs**
  - `POST /api/feedback` rates the latest generation of a task for a job or person (`src/components/Rate.tsx`).
- **Per-seeker learning**
  - `userStyle()` (`worker/lib/shared.ts`) appends the seeker's own edited or liked notes and letters as style examples to the next draft's user message, with their last thumbs-down notes.
  - It is still one call and takes no facts from the examples.
- **Model routing**
  - `modelRanking()` (`worker/lib/quality.ts`) scores each model per task over 30 days (answered share minus verifier-flag and thumbs-down share, at least 20 calls) and reorders the free and Smart chains. It is cached for an hour.
- **Report**
  - `npm run quality` (reads only; `QUALITY_DATABASE_URL` or `DATABASE_URL`) and the Quality section on `/admin` show the numbers per task, prompt version and model.
  - They also show evaluation-score and person-rank calibration against real outcomes, and the latest thumbs-down notes.
- **Eval**
  - `npm run eval` replays `eval/fixtures/*.json` (synthetic) plus `eval/fixtures/private/` (your own data, from `npm run eval:export`, gitignored) through the production prompts. It scores them with the verifiers and a judge call, and diffs the run against `eval/results/baseline.json` (`--save-baseline`).
- **Weekly agent**
  - A scheduled Claude Code routine follows `IMPROVE.md`: report → at most two data-backed fixes → eval before and after → a PR for a human to merge.
- **Checks**: `npx tsx worker/lib/quality.check.ts`.

## Self-host

Agisse runs on Cloudflare's free plan plus a free Neon Postgres database.

**Required:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ADMIN_EMAIL` (your account becomes the admin) and `OPENROUTER_API_KEY` (the server's key; free models cost nothing, and users can still connect their own key under Profile → AI).

**Optional:** each one turns a feature on, and the app works without it.

| Key | Turns on |
|---|---|
| `EXA_API_KEY` | People search |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Job search by city, and more postings in the feed |
| `RESEND_API_KEY` | Emails (otherwise they are logged to the console) |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Sign in with Google |
| `TURNSTILE_SECRET_KEY` + `VITE_TURNSTILE_SITE_KEY` | Bot protection on sign-in |
| `SENTRY_DSN`, `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` | Error tracking and analytics (off by default) |
| `VITE_LOGO_DEV_TOKEN` | Company logos (otherwise monograms) |

Before deploying, edit `wrangler.jsonc`: replace the `agisse.xyz` routes with your domain (or remove them to use `*.workers.dev`), and create the R2 bucket named in `r2_buckets` (`npx wrangler r2 bucket create agisse-resumes`). Then follow [Run locally](#run-locally) and [Deploy](#deploy-to-cloudflare-free-plan).

**Become the admin:** sign up with your email while `ADMIN_EMAIL` is still unset (that address is reserved once it is set), then run this once in your database (for example the Neon SQL editor) and set `ADMIN_EMAIL` to the same address:

```sql
UPDATE "user" SET is_admin = true, access_status = 'approved' WHERE lower(email) = 'you@example.com';
```

The name and logo are not covered by the license. If you offer your copy to others, rename it (see [TRADEMARK.md](TRADEMARK.md)).

## Run locally

```sh
cp .env.example .env      # fill in DATABASE_URL, BETTER_AUTH_SECRET, ADMIN_EMAIL, OPENROUTER_API_KEY
cp .env .dev.vars         # wrangler / the Vite plugin read secrets from .dev.vars
npm install
npm run db:migrate        # applies drizzle/ migrations to DATABASE_URL
npm run dev               # http://localhost:5173 (SPA + Worker in workerd)
```

`BETTER_AUTH_SECRET`: `openssl rand -base64 32`.

City search is optional. Register at Adzuna, add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` to `.dev.vars`, then deploy them with `npx wrangler secret put ADZUNA_APP_ID` and `npx wrangler secret put ADZUNA_APP_KEY`. Without both keys, the city tab stays hidden.

## Browser extension

Users get it from the Jobs page ("Send from your browser"), which links `/agisse-extension.zip`; `npm run ext:zip` builds that zip into `public/` (also run by `dev` and `build`). For development, load `agisse/extension` directly: `chrome://extensions` → Developer mode → Load unpacked. Pick agisse.xyz or localhost in the popup. It does nothing on LinkedIn. User docs: `/docs/extension`.

## MCP

`worker/lib/mcp.ts` exposes a remote MCP server at `/mcp` (OAuth via the Better Auth `mcp` plugin, wired in `worker/index.ts`) so an AI client can read and act on one signed-in user's data. Docs (endpoint, auth, tool list): `/docs/mcp`.

## Docs site

`docs/` is a small [VitePress](https://vitepress.dev) site (just the extension and MCP pages above). `npm run docs:dev` to preview; `npm run docs:build` builds it into `public/docs`, served at `/docs` by the same Worker (also run by `dev` and `build`).

## Deploy to Cloudflare (free plan)

```sh
npx wrangler login
npm run secrets           # pushes the secrets in .env to the Worker
npm run deploy            # tsc + vite build + wrangler deploy
```

Non-secret settings live in `wrangler.jsonc` → `vars`:

- `OPENROUTER_MODELS` — comma-separated preference list. The Worker also discovers other `:free` models that support structured output.
- `MONTHLY_BUDGET_EUR` — default allowance per user per calendar month, in €. The admin can override it per account at `/admin`.
- `PRICE_MARGIN` — share of a user's spend kept as margin. Users are charged provider cost ÷ (1 − margin), so at `0.5` a €10 allowance costs at most €5 (plus the overshoot of the one request that crosses the line).
- `TOKEN_EUR_PER_MILLION` — nominal € charged per million OpenRouter tokens, since the free models bill $0. Kept generous (`0.05`: the €2 default ≈ 40M tokens).
- `USD_TO_EUR` — conversion for provider costs, which arrive in USD (OpenRouter `usage.cost`, Exa `costDollars`). Update it when the rate drifts.

Every paid request (search rounds, notes, résumé import) is booked in the `usage` table with its tokens and USD cost, failed attempts included.

## Costs and limits worth knowing

- **OpenRouter free models**: 50 requests/day per account until you have bought $10 of credits once, then 1,000/day. Free models are slow (15–90 s) and occasionally rate-limited; the UI shows progress and the Worker walks the fallback chain within a 120 s budget.
- **Exa**: ~$0.007 per people query; a search runs 2–3 queries. The same request within 7 days is served from `exa_cache` for free.
- **Workers Free**: 100k requests/day, 10 ms CPU per request. Outbound fetch wait time does not count as CPU.
- **Neon Free**: fine for this app's row counts.

## Database changes

Edit `worker/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`.

## Design

Visual system: [DESIGN.md](DESIGN.md) (written from the built world).

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) (we use DCO sign-off, no CLA), [SECURITY.md](SECURITY.md) and [GOVERNANCE.md](GOVERNANCE.md).

Copyright © 2026 Lennart Steen and Agisse contributors. Licensed under the [GNU Affero General Public License v3.0](LICENSE). If you run a modified copy as a service, you must offer its source to your users. Third-party notices are in [NOTICE](NOTICE).
