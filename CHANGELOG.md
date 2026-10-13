# Changelog

All notable changes to Agisse are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- CI on every pull request: build with typecheck, lint, and every `*.check.ts`.
- Security workflows: gitleaks on every pull request; CodeQL, OpenSSF Scorecard and dependency review once the repository is public.
- Issue forms for bugs, feature ideas and self-host help, and a pull request template.
- `npm run db:seed` fills a development database with synthetic companies, roles and a test student.
- A release workflow that attaches the browser extension zip to each GitHub release.
- `worker/index.check.ts` boots the Worker with only the required secrets and walks the main routes; with a development `DATABASE_URL` it signs up a synthetic user and removes it again.
- An architecture page in the docs.
- `npm run eval:feed` ranks the job feed for 12 synthetic graduate personas (nursing to logistics) and reports, per persona, how many roles pass their filters, how on-field the top 30 is and how many employers it shows. No model calls.
- A feed contract in the docs: the columns, values and open-role rule a feed provider writes, checked against the schema.

### Changed

- Without any AI key, model features now say "Connect your AI key in Profile" instead of failing with a provider error, so a self-hosted copy can run on users' own keys alone.
- Builds load the Sentry plugin only when `SENTRY_AUTH_TOKEN` is set; self-hosted builds contact no telemetry service by default.
- `OPENROUTER_API_KEY`, `EXA_API_KEY` and `SENTRY_DSN` are optional secrets now; only `DATABASE_URL` and `BETTER_AUTH_SECRET` are required to deploy.
- Emails go out from `EMAIL_FROM` when it is set, so a self-hosted copy can send through its own Resend domain. The default stays `hello@agisse.xyz`.
- The feed's field labels now read "Operations & logistics" and "Policy & public sector", so supply-chain and public-sector graduates find their field.

[Unreleased]: https://github.com/Agisse/agisse/commits/main
