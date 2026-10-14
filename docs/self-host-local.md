---
title: Local mode design
description: How npx agisse runs the same app on Node or Bun with an embedded Postgres, and what stands in for each Cloudflare binding.
---

# Local mode design

`npx agisse` runs Agisse on one computer with Node 20+ or Bun: `http://localhost:3000`, everything in `./agisse-data/`. This page is the design for it; the Cloudflare path (`npm run self-host`) stays as it is.

## The boundary

The app is shared: the React build in `dist/client`, the Hono `app` and every route in `worker/`, the Drizzle schema and the migrations in `drizzle/`. Only the entry point differs.

| | Cloudflare | Local |
|---|---|---|
| Entry | `worker/index.ts` default export | `local/` (new): `@hono/node-server` serving the same `app` |
| Database | Neon over HTTP (`drizzle-orm/neon-http`) | `DATABASE_URL` if set, else PGlite at `agisse-data/db` (`drizzle-orm/pglite`) |
| Migrations | `npm run db:migrate` by hand | applied on every start |
| Config | `wrangler.jsonc` vars and secrets | the same names from the environment; `BETTER_AUTH_SECRET` generated once into `agisse-data/` |

Nothing in `local/` is imported from `worker/`, so the Worker bundle can't pick up PGlite or Node-only code. The I2 PR proves it with the bundle budget (`scripts/bundle-budget.json`) and the `wrangler deploy --dry-run` size before and after.

## Bindings and their stand-ins

Every Cloudflare-only thing the Worker uses today, from `wrangler.jsonc` and `grep` over `worker/`:

| Binding or global | Used in | Local stand-in |
|---|---|---|
| `ASSETS` | `app.notFound`: static files and the SPA fallback | an object with `fetch(req)` that reads `dist/client`; a missing file is a 404, so the existing fallback to `/` still applies |
| `RESUMES` (R2) | résumé upload, delete account | `put`, `get` and `delete` on files under `agisse-data/files/` |
| `AUTH_LIMITER`, `API_LIMITER` | sign-in and sign-up per IP; non-GET `/api` per user | an in-memory fixed window with the same limits (10 and 60 a minute); per process |
| `cf-connecting-ip` header | `AUTH_LIMITER` key | set from the socket's address before the request reaches `app` |
| `caches.default` | `edgeCached()`: facets and public stats | a global `caches` with a `default` whose `match` returns nothing and `put` does nothing (no cache, every request runs the query) |
| `executionCtx.waitUntil` | `edgeCached()`, approval emails | `{ waitUntil: (p) => p.catch(console.error), passThroughOnException() {} }` as the third argument of `app.fetch` |
| `HTMLRewriter` | `app.notFound`: `<html data-launch>` and the emptied `#root` | a string rewrite of `index.html` for those two cases (see below) |
| `CF_VERSION_METADATA` | declared for Sentry releases; no route reads it | `{ id: <package version> }` |
| `scheduled` (cron `17 4 * * *`) | closed postings, old feed-cap rows | the same handler on a timer: once at start, then every 24 hours |
| `@sentry/hono/cloudflare` | `app.use(sentry(...))` | stays; without `SENTRY_DSN` it sends nothing. I2 confirms it loads on Node and Bun |

### The HTML rewrite

`app.notFound` uses `HTMLRewriter` twice: it adds `data-launch` to `<html>` when `PUBLIC_LAUNCH=1`, and empties `#root` for signed-in requests and app paths, so the crawler copy of the homepage doesn't flash before the app. Node has no `HTMLRewriter`. The smallest stand-in is a global with the same `on(selector, handler).transform(response)` shape that handles only `html` (`setAttribute`) and `#root` (`setInnerContent('')`) with string operations on `index.html`, which the build controls. A third selector in the Worker then needs the stand-in to grow, so the I2 check fails on any selector it doesn't know.

## Database

PGlite is Postgres compiled to WebAssembly, so the schema, `halfvec` matching and `tsvector` search stay as they are. Checked on 2026-10-14 with `@electric-sql/pglite` 0.5.9:

- **Version:** PostgreSQL 18.6, the same as the dev Neon branch.
- **pgvector:** since PGlite 0.5, the `vector` extension is its own package, `@electric-sql/pglite-pgvector` (0.0.10, pinned to PGlite's version). It reports pgvector 0.8.7; `halfvec(384)` and the `<=>` distance work.
- **Full-text search:** `to_tsvector`, the generated `search` column and `ts_rank_cd` work.
- **Migrations:** all 34 files in `drizzle/` (`0000` to `0033`) apply on an empty PGlite database with no errors, statement by statement on `--> statement-breakpoint`. None needs a fix.

Driver differences the code has to handle:

- `createDb()` returns the Neon HTTP type (`Db`). Local mode passes a PGlite Drizzle instance in its place: the `withDbAuth` middleware takes an injected `db` when the entry provides one, and `Db` widens to Drizzle's shared Postgres type. That's the only change in `worker/`.
- `db.execute()` returns `{ rows }` on both drivers, which `worker/lib/quality.ts` already reads.
- No route uses `db.transaction()` or `db.batch()`.
- `Server-Timing` counts queries through Neon's `fetchFunction`; on PGlite it reports 0 queries. Fine for local use.
- PGlite allows one connection, in one process: one `npx agisse` per `agisse-data/` folder.

## New dependencies

Three, all for local mode and none in the Worker bundle:

- `@hono/node-server`: serves `app` on Node (Bun runs `app.fetch` directly with `Bun.serve`).
- `@electric-sql/pglite`: the embedded database.
- `@electric-sql/pglite-pgvector`: `halfvec`, which the feed's ranking needs.

## What local mode lacks

- No edge cache: facet counts run their queries on every request.
- Rate limits count per process and reset on restart.
- One process per data folder: PGlite takes no lock of its own, so Agisse keeps a pid in `agisse-data/db.pid` and refuses to start a second one. Stop Agisse before `import-feed` or a backup.
- Backups are copies of `agisse-data/` taken while Agisse is stopped.
- No email without `RESEND_API_KEY`: each email's link (a password reset, say) prints to the console instead.
- No SQL editor for the first admin: sign up, then run `npx agisse admin you@example.com` (for now `npm run local -- admin you@example.com`) with Agisse stopped. It approves that account, makes it the admin, and keeps the address in `agisse-data/admin-email` as `ADMIN_EMAIL`.
- The feed starts empty. `npx agisse import-feed` (for now `npm run local -- import-feed`) loads public Arbeitnow roles (see the [feed contract](/feed-contract)). Run it again to refresh: a role leaves the feed 3 days after its last import.
