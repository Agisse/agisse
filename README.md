<h1 align="center">Agisse</h1>

<p align="center"><strong>Honest job advice for students. Free and open source.</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue"></a>
  <a href="https://github.com/Agisse/agisse/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Agisse/agisse/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/Agisse/agisse"><img alt="OpenSSF Scorecard" src="https://api.scorecard.dev/projects/github.com/Agisse/agisse/badge"></a>
</p>

<p align="center"><strong>English</strong> · <a href="README.nl.md">Nederlands</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.it.md">Italiano</a> · <a href="README.pl.md">Polski</a></p>

<!-- GIF (20 s, synthetic @example.com data): paste a posting → the score and an honest "don't apply" → a warm intro through a shared university → the tracker. Add it here once recorded. -->

<!-- translations:start -->
Agisse is a job-search copilot for students and early-career people in Europe:

- **A feed of European roles** ranked against your CV, with an honest apply-or-skip score. Below 4.0 it tells you not to apply.
- **Warm introductions** grounded in real shared ground: the same university, employer or student organisation. You always send the message yourself; Agisse never logs into your LinkedIn account.
- **Prep and tracking**: the interview process and online assessments a company uses, practice with feedback, and a board for every application.

Free at [agisse.xyz](https://agisse.xyz): try it on free AI models, then connect your own OpenRouter key for real use. Or run your own copy with `npx agisse`: see the [self-host guide](https://agisse.xyz/docs/self-host). No ads, no selling data, no paid placement in the feed.

All the code is open (AGPL-3.0). The job feed on agisse.xyz isn't: a self-hosted copy starts empty, and you fill it with your own source ([feed contract](https://agisse.xyz/docs/feed-contract)).
<!-- translations:end -->

⭐ **Star us if you believe students deserve honest job advice.**

Hired with Agisse: [0 stories](HIRED.md). Got the job? Share yours there.

## Self-host

Same app, three ways. The code is open; agisse.xyz's job feed is not, so your copy starts with an empty one. Fill it with your own provider ([feed contract](docs/feed-contract.md)) or public roles from Arbeitnow.

**With your coding agent.** Paste this into Claude Code, Codex or Cursor:

```text
Read https://agisse.xyz/agent.md and set up my own Agisse.
```

It asks whether the copy is just for you or a public site, then does the steps below with you.

**On your computer.** Use one package manager to start the published app. Node 20+ is needed for npm, pnpm and Yarn; Bun can run it without Node.

| Package manager | Start Agisse |
| --- | --- |
| npm | `npx agisse` |
| Bun | `bunx --bun agisse` |
| pnpm | `pnpm dlx agisse` |
| Yarn | `yarn dlx agisse` |

Open http://localhost:3000. Your account and files stay in `./agisse-data/`. Run `agisse --help` through the same package manager to see the optional commands. To connect an AI agent to your account, follow the [MCP guide](docs/mcp.md). The npm package includes a source archive for its exact release under `source/`.

**On Cloudflare.** A public site on Cloudflare's free plan and a free [Neon](https://neon.tech) database:

```sh
git clone https://github.com/Agisse/agisse.git && cd agisse
npm install && cp .env.example .env   # DATABASE_URL, BETTER_AUTH_SECRET, SELF_HOST_DOMAIN
npx wrangler login
npm run self-host                     # storage, migrations, build, deploy. Re-run to update
```

Every other key is optional and turns one feature on: AI on the server's key, people search, Google sign-in, emails. Telemetry is off unless you set it. Step by step, making yourself the admin, and your duties if others use your copy: [docs/self-host](docs/self-host.md).

## Develop

```sh
cp .env.example .env      # DATABASE_URL, BETTER_AUTH_SECRET, ADMIN_EMAIL; OPENROUTER_API_KEY, or bring your own key
cp .env .dev.vars         # the Worker reads its secrets from .dev.vars
npm install
npm run db:migrate
npm run dev               # http://localhost:5173
```

- **Checks:** `npm run lint`, `npm run check` (every `*.check.ts`), `npm run build`.
- **Database changes:** edit `worker/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`.
- **Extension:** load `extension/` unpacked at `chrome://extensions` (Developer mode).
- **Docs site:** `npm run docs:dev`.

## How it works

One Cloudflare Worker serves the React app, the API and an [MCP server](docs/mcp.md), backed by Postgres. Each AI feature is one structured model call, and code then checks it against your own text: a CV never gains an employer you didn't have, and a cited source must be a real search result.

- [Architecture](docs/architecture.md): the pieces and where they live.
- [Methodology](docs/methodology.md): how the fit score is made.
- [Data flow](docs/data-flow.md): what is stored, and which service sees what.
- [Internals](docs/internals.md): every feature route by route, how answers improve over time, settings and costs.
- [DESIGN.md](DESIGN.md): the visual system.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) (DCO sign-off, no CLA), [SECURITY.md](SECURITY.md) and [GOVERNANCE.md](GOVERNANCE.md).

Copyright © 2026 Lennart Steen and Agisse contributors. Licensed under the [GNU Affero General Public License v3.0](LICENSE): if you run a modified copy as a service, offer its source to your users. The name and logo aren't covered; rename your copy if you offer it to others ([TRADEMARK.md](TRADEMARK.md)). Third-party notices are in [NOTICE](NOTICE).
