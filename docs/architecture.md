---
title: Architecture
description: How Agisse is put together. One Cloudflare Worker serves a React app and a JSON API, with Neon Postgres, R2 and the AI providers behind it.
---

# Architecture

Agisse is one Cloudflare Worker. It serves the React app, the JSON API and the MCP server from the same origin, and talks to a Postgres database over HTTP.

```text
 Browser (React app) ─┐
 Browser extension ───┼──▶ Cloudflare Worker ──▶ Neon Postgres (HTTP)
 MCP client ──────────┘    worker/index.ts   ──▶ R2: résumé PDFs
                                             ──▶ AI provider (OpenRouter or the user's own key)
                                             ──▶ Exa, Wikidata, Adzuna, public ATS boards, Resend
```

## Pieces

| Piece | Where | What it does |
|---|---|---|
| Web app | `src/` | Vite + React 19 single-page app, built into `dist/client` and served as Worker assets |
| API | `worker/index.ts` | Hono routes under `/api`, signed-in by session cookie |
| Auth | `worker/auth.ts` | Better Auth: email and password, optional Google sign-in, and the OAuth provider the MCP server uses |
| MCP server | `worker/lib/mcp.ts` | `/mcp`, the same account and data as the web app, see [MCP](/mcp) |
| Extension | `extension/` | Manifest V3; calls the same API with the user's session, see [Extension](/extension) |
| Database | `worker/db/schema.ts`, `drizzle/` | Neon Postgres through `@neondatabase/serverless`, Drizzle ORM and migrations |
| File storage | R2 bucket `RESUMES` | One original résumé PDF per user, `resumes/<userId>.pdf` |
| Daily job | `worker/lib/closed.ts` | Cron at 04:17 UTC: marks saved postings closed when their public ATS board no longer lists them |
| Docs | `docs/` | This VitePress site, built into `public/docs` |
| Shared code | `shared/` | Types and pure logic used by both the app and the Worker (CV review rules, listings) |

## Model calls

Every AI feature goes through `worker/lib/openrouter.ts`. It uses the user's own key when they have connected one (`worker/lib/byok.ts`: OpenRouter, OpenAI, Anthropic, Gemini or Mistral), else the server's `OPENROUTER_API_KEY`. With neither, the feature answers "Connect your AI key in Profile" instead of failing. Features are built around at most one model call per user action. Calls on the server's key count against the user's monthly allowance; calls on the user's own key are billed by their provider and count against nothing.

## The job feed

The feed reads the `vacancy` table and ranks it per user without a model call: an embedding match against the user's profile, their chosen functions, freshness and deadlines (`worker/lib/vacancies.ts`). This repository doesn't fill that table. A separate feed provider writes `vacancy`, `profile_embedding` and `vacancy_fit` to the [feed contract](/feed-contract); agisse.xyz's own provider is private. A self-hosted copy starts with an empty feed, or with the synthetic roles from `npm run db:seed`.

## Free tiers

Agisse is built to stay inside Cloudflare's and Neon's free plans. The daily job fetches at most 40 boards so it stays under the free plan's subrequest limit. The `AUTH_LIMITER` and `API_LIMITER` rate limits are free bindings too.
