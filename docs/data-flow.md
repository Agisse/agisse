---
title: Data flow
description: What Agisse stores, where it is stored, and which outside service sees what. Read from the code, for self-hosters and the curious.
---

# Data flow

This page describes what the code does: what is stored, where, and which outside service sees which data. The [privacy policy](/privacy) is the legal text for agisse.xyz. A self-hosted copy uses your own accounts for each service below, and leaves out any service you don't configure.

## What is stored, and where

| Data | Where | Notes |
|---|---|---|
| Account, sessions, sign-in method | Postgres: `user`, `session`, `account` | Passwords are hashed by Better Auth |
| Profile and résumé text | Postgres: `profile` | The PDF's text is read in the browser (`src/lib/pdf-text.ts`) |
| Original résumé PDF | R2: `resumes/<userId>.pdf` | One per user, replaced on re-upload |
| Own AI key | Postgres: `ai_key` | AES-GCM encrypted, never sent back to the browser; only the last four characters are shown |
| Saved postings, tracker, notes, drafts | Postgres: `job` | Per user |
| Pasted posting text | Postgres: `posting` | Shared across users, so two people who paste the same job reuse one evaluation. It holds the posting, not anyone's CV |
| People found at a company | Postgres: `search`, `person` | Public profile text from Exa, per user |
| Practice answers, interview and assessment prep | Postgres: `practice_answer`, `interview_question_set`, `training_session`, … | Per user. Mock-interview video stays in the browser |
| AI usage | Postgres: `usage` | Feature, model, tokens and cost, for the monthly allowance |
| Feed pages per day | Postgres: `feed_day` | A count per day, for the feed's daily limit; deleted after 30 days |
| Admin actions | Postgres: `admin_action` | Which admin exported or deleted which account id, and when; no content. Kept after the account is deleted |
| Live switches | Postgres: `setting` | Limits an admin changed in `/admin` (daily caps, the feed's page cap, the monthly allowance), with the account id of who changed each last; set to null when that account is deleted |
| Web search cache | Postgres: `exa_cache` | About a week |
| Company facts | Postgres: `company` | From Wikidata, refreshed after 30 days |
| Job feed | Postgres: `vacancy`, `profile_embedding`, `vacancy_fit` | Written by a feed provider outside this repo, see below |

Deleting an account removes the user's own rows (foreign keys cascade) and their PDF in R2. Shared rows, such as how a company's hiring rounds run (`assessment_intel`, `selection_intel`), stay, with the link to the user removed.

## Who sees what

### From the Worker

| Service | When | What it receives |
|---|---|---|
| Neon | Always | Everything stored above |
| Cloudflare R2 | Résumé upload | The PDF |
| OpenRouter | An AI feature, on the server's key or the user's OpenRouter key | What the feature needs, such as résumé text, profile and a posting |
| OpenAI, Anthropic, Google Gemini or Mistral | An AI feature, when the user connected that provider's key | The same, sent straight to that provider instead of OpenRouter |
| Exa | People and company search (`EXA_API_KEY`) | The company, role and search terms |
| Wikidata | Company facts | A company's website domain |
| Adzuna | City search | A role and a city |
| Public ATS boards (Greenhouse, Lever, Ashby, …) | The daily closed-posting check | The board's public listing URL |
| Resend | Account email (`RESEND_API_KEY`) | The recipient's email address and the message |
| Google | Sign in with Google (`GOOGLE_CLIENT_ID`) | The standard OAuth exchange |
| Sentry | Worker errors (`SENTRY_DSN`) | Error details, without request bodies or cookies |

Before any model call, on any key, email addresses, phone numbers, labelled birth dates, addresses and photo lines, and national ID numbers in the prompt are swapped for placeholders such as `[email 1]` (`worker/lib/redact.ts`). The real values go back into the model's answer, so a tailored CV keeps its header. Names stay: a cover letter needs one.

### From the browser

| Service | When | What it receives |
|---|---|---|
| Nominatim (OpenStreetMap) | The world map | Location names of roles, and the user's IP address |
| OpenFreeMap | The world map | Map tile requests, and the user's IP address |
| logo.dev | Company logos (`VITE_LOGO_DEV_TOKEN`) | A company's domain, and the user's IP address |
| Cloudflare Turnstile | The sign-up and sign-in forms (`TURNSTILE_SECRET_KEY`) | The bot check, and the user's IP address |
| PostHog | Analytics (`VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`) | Pages viewed and buttons clicked, with the account id (never the name or email). No session recordings |
| The browser's speech recognition | Mock interview, where the browser has it | The answer's audio, handled by the browser vendor |

Where the browser has no speech recognition (Firefox), the answer's audio goes once to the Worker, which has a model transcribe it and keeps only the text.

The [extension](/extension) talks only to Agisse, and only when you click.

### The job feed

A feed provider fills the job feed. It isn't part of this repository; agisse.xyz's own provider is private. It writes public early-career vacancies into `vacancy`, embeds each user's profile and résumé into `profile_embedding`, and writes a fit score per user and role into `vacancy_fit`, so it reads users' profiles and résumés. The [feed contract](/feed-contract) describes those tables. A self-hosted copy has none of this unless you run a provider that writes them; the feed then shows whatever `vacancy` holds, such as the synthetic roles from `npm run db:seed`.

## Telemetry

Off by default. A self-hosted copy sends nothing to Agisse, Sentry or PostHog unless you set `SENTRY_DSN`, `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`, or `SENTRY_AUTH_TOKEN`. Your own keys send to your own accounts.
