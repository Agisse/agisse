---
title: Performance
description: How fast Agisse loads, how it is measured, and the targets every change is held to.
---

# Performance

Agisse should feel instant, also on a mid-range phone on 4G. This page has the targets, how to measure them, and the latest numbers. The raw numbers are in [`eval/results/perf-baseline.json`](https://github.com/Agisse/agisse/blob/main/eval/results/perf-baseline.json).

## Targets

| What | Target | Baseline (2026-10-14) | Latest (2026-10-15) |
|---|---|---|---|
| Landing page LCP, Lighthouse mobile | under 1.5 s | 6.5 s on agisse.xyz | 2.3 s on agisse.xyz |
| Jobs LCP, Lighthouse mobile | under 2.5 s | about 5 s (estimated, see below) | not measured |
| Initial JS, gzipped | under 150 kB | 782 kB | 129 kB |
| API round trips | no more than a route needs | `/api/me` 10, facets 7 | see API below |

## Measure it yourself

**Bundle.** After `npm run build`:

```sh
npx tsx scripts/bundle-size.ts
```

It prints the gzipped JS and CSS the first page load downloads, and the biggest packages in that JS.

CI runs it with `--check` and fails when the initial JS grows more than 10% over `scripts/bundle-budget.json`. A PR that makes the bundle smaller lowers that number; one that needs more raises it on purpose and says why.

**API.** Every `/api`, `/mcp` and `/.well-known` response carries a `Server-Timing` header with the number of database round trips and their time. Open DevTools → Network → Timing, or:

```sh
curl -s -o /dev/null -D - http://localhost:5173/api/me -b 'better-auth.session_token=…' | grep -i server-timing
# server-timing: db;dur=148;desc="10 queries", total;dur=50
```

`db` is the sum of all queries, so queries that run in parallel can add up to more than `total`.

**Lighthouse.** On the built app (`npm run build`, then `npx vite preview`):

```sh
npx lighthouse@12 http://localhost:4173/ --only-categories=performance --chrome-flags="--headless=new"
```

The preview server sends assets uncompressed, while Cloudflare compresses them in production, so local times come out about three times slower. Compare local runs with each other, not with the targets. For signed-in pages, put a session cookie in a Chromium profile and pass `--disable-storage-reset --chrome-flags="--user-data-dir=…"`. Lighthouse's `--extra-headers` cookie only reaches the HTML, not the app's API calls.

## Baseline, 2026-10-14

**Bundle.** The whole app is one 2.4 MB script (782 kB gzipped), plus 46 kB of CSS. Only the maps and the PDF reader load later. The biggest parts, minified:

| Package | kB |
|---|---|
| `posthog-js` | 306 |
| `react-dom` | 208 |
| `@assistant-ui/core` + `react` | 260 |
| `@base-ui/react` | 140 |
| `motion-dom` + `framer-motion` | 125 |
| `src/routes/Jobs.tsx` | 59 |

**Lighthouse, agisse.xyz signed out.** Landing: score 72, FCP 1.1 s, LCP 6.5 s, TBT 260 ms, CLS 0. The hero heading only paints after the full app script has loaded and run. PostHog also loads its session recorder and surveys on the landing page. The docs: score 100, LCP 1.5 s.

**Lighthouse, agisse.xyz signed out, 2026-10-15** (after the code splitting in #91–#95 and #98). Landing: score 98, FCP 1.7 s, LCP 2.3 s, TBT 27 ms, CLS 0. The LCP element is still the hero heading; 73% of its time is render delay, the wait for the app script to draw it, and the 41 kB stylesheet blocks the first paint for about 0.3 s. The docs: score 99, LCP 1.8 s.

**Lighthouse, local preview** (uncompressed, so relative only). Landing, sign-in, Home and Jobs all land at FCP about 14.3 s, because all four wait for the same script. Home has a CLS of 0.086, Jobs 0.012. Scaled to compressed transfer, Jobs would be around 5 s.

**Requests before Home shows data.** Four steps, one after the other: the HTML, the script, `/api/auth/get-session`, then `/api/me`, and only then `/api/referral`, `/api/contacted`, `/api/jobs` and `/api/due` in parallel. The Jobs feed waits for `/api/vacancies` (about 400 ms locally) and `/api/vacancies/facets` (about 600 ms).

**API**, warm, against the dev database, median of five. Every signed-in route pays two round trips for the session check.

| Route | Round trips | Time |
|---|---|---|
| `/api/auth/get-session` | 1 | 19 ms |
| `/api/me` | 10 | 53 ms |
| `/api/due`, `/api/jobs` | 4 | 45 ms |
| `/api/contacted` | 3 | 43 ms |
| `/api/vacancies` | 5 | 80–100 ms |
| `/api/vacancies/facets` | 7 | 544 ms |
| `/api/public/stats` | 1, then 0 | edge cache |

**Sentry tracing**, measured 2026-10-14 in `npm run dev` against a local stub collector, median of 30. Tracing every request adds about 6 ms to a cached `/api/public/stats` (18 → 24 ms) and 11 ms to `/api/me` (68 → 79 ms), and sends one envelope of 5 kB (stats) to 20 kB (`/api/me`) per request. Errors are reported either way, so Agisse traces one request in ten.

## What comes next

- Load the landing page without the app, and the app's pages one by one (`React.lazy`). PostHog, motion and the assistant load late.
- Draw the page layout at once and fill it in, instead of waiting on `get-session` and then `/api/me`.
- `/api/me` loads the user twice (once in the session check). The feed facets are the same for everyone, so they can come from the edge cache.
- Hashed assets skip the Worker and are cached for a year.
