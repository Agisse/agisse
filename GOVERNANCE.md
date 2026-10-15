# Governance

Agisse is a free, open-source project (AGPL-3.0) with one mission: help students and early-career job seekers find work honestly. The hosted service at agisse.xyz runs on free AI models plus each user's own AI key, so it costs little to host. It has no paid plans and no ads, and it never sells user data or paid placement.

## Open code, hosted data

The code is open source (AGPL). The job data on agisse.xyz is not: it's collected and maintained by the hosted service, and that curated feed is much of why agisse.xyz is worth using. A self-hosted copy starts with an empty feed; fill it with your own provider (see the [feed contract](docs/feed-contract.md)) or the Arbeitnow importer (`scripts/import-feed.ts`).

## On the student's side

Agisse works for the people looking for a job, never for employers:

- It never scores or ranks candidates for employers.
- It never sells or shares user data with employers.
- It takes no paid placement: no employer pays to appear in the feed or to rank higher.

## Today

The project is led by its founder, Lennart Steen, who has the final say on what gets merged and released. There's no company or association behind it.

## Roles

Generous with credit, careful with access.

- **Participant:** everyone who opens an issue, answers in Discussions, reviews a translation or reports a bug.
- **Contributor:** anyone with three merged pull requests. It's automatic: the project lead invites you to the `contributors` team on GitHub.
- **Reviewer or area owner:** by invitation, for contributors who review well in one area. You're listed in [`MAINTAINERS.md`](MAINTAINERS.md) and in `CODEOWNERS` for that area, and your review counts there. Agisse holds people's career data, so the project lead confirms who you are in a short video call before giving you review or merge rights.

## Big changes

A change that alters how Agisse works for everyone (a new data flow, a new dependency on an outside service, a change to the score) starts as a post in the RFC category of GitHub Discussions, before any code. Smaller changes go straight to a pull request.

## Sponsors

Sponsors, such as a provider's free-credits program, get thanked in public. Sponsorship never buys a say in the roadmap, the feed or the score.
