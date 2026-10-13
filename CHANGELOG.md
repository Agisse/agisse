# Changelog

All notable changes to Agisse are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- CI on every pull request: build with typecheck, lint, and every `*.check.ts`.
- Security workflows: gitleaks on every pull request; CodeQL, OpenSSF Scorecard and dependency review once the repository is public.
- Issue forms for bugs, feature ideas and self-host help, and a pull request template.
- `npm run db:seed` fills a development database with synthetic companies, roles and a test student.
- A release workflow that attaches the browser extension zip to each GitHub release.

### Changed

- Without any AI key, model features now say "Connect your AI key in Profile" instead of failing with a provider error, so a self-hosted copy can run on users' own keys alone.
- Builds load the Sentry plugin only when `SENTRY_AUTH_TOKEN` is set; self-hosted builds contact no telemetry service by default.
- `OPENROUTER_API_KEY`, `EXA_API_KEY` and `SENTRY_DSN` are optional secrets now; only `DATABASE_URL` and `BETTER_AUTH_SECRET` are required to deploy.

[Unreleased]: https://github.com/Agisse/agisse/commits/main
