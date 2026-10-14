---
title: Methodology
description: How Agisse scores a job posting from 1 to 5, why below 4.0 means don't apply, how the job feed is ranked, and what the scores can't know.
---

# Methodology

Agisse gives two kinds of score. A posting you check gets a **score from 1 to 5** and a verdict: apply or skip. The roles in your feed get a **match from 0 to 100**, which only decides their order. This page explains both, read from the code.

## The 1–5 score of a posting

When you check a posting, one model call reads it next to your CV. It runs on the AI key in use: Agisse's, or your own. The prompt is `evaluationBrief` in [`worker/lib/jobs.ts`](https://github.com/Agisse/agisse/blob/main/worker/lib/jobs.ts).

The model works in two passes:

1. **The posting alone.** It lists up to 12 requirements and rates how much each matters, from the posting's own wording: must-have language, order, repetition. Your CV doesn't change how much a requirement matters.
2. **Then your CV.** It marks each requirement as strong, partial or missing, and quotes what in your CV backs it. It may not claim experience your CV doesn't show.

It then rates five things from 1 to 5:

| Dimension | What it asks |
|---|---|
| CV match | Your skills, experience and proof points against the requirements |
| Direction | The role against the industries and direction you set |
| Pay | Pay against the market for the level. Exactly 3 when the posting states no pay |
| Culture | Culture, growth and stability signals. 3 when unknown |
| Red flags | 5 means no blockers or warnings, 1 means serious ones |

The overall score is a judgement over the five, not an average. Without an imported résumé, it uses your profile fields only, so it is rougher.

## The 4.0 line

The verdict comes from the score, in code (`recommendationFor`), not from the model:

| Score | Verdict |
|---|---|
| 4.5 to 5 | Apply now |
| 4.0 to 4.4 | Worth applying |
| Below 4.0 | Long shot |

Below 4.0, Agisse names the gaps it found and leaves the call to you. Most postings are not a strong fit, and the prompt tells the model to say so. Sending fewer, better applications is the point.

A few rules are enforced in code rather than trusted to the model (`finalizeEvaluation`):

- the score is kept between 1 and 5 and rounded to one decimal;
- a requirement the model only guessed at can't count as a top requirement;
- when the posting says it doesn't sponsor work visas, that shows as a blocker above everything else.

## The quick look

Before the full check, **Quick look** gives a short verdict on a pasted posting: strong fit, worth applying, a stretch, or a different field or level. A small scoring model (Jev, through OpenRouter) answers one question on a four-step scale (`FIT_SCALE` in [`worker/lib/vacancies.ts`](https://github.com/Agisse/agisse/blob/main/worker/lib/vacancies.ts)). Nothing is stored.

## The 0–100 match in your feed

Opening the feed makes no model call. Each role's match is:

```text
match = 60% fit + 15% one of your fields + 15% freshness + 10% deadline within two weeks
```

- **Fit** is the quick look's question, answered ahead of time by the feed provider for your closest roles. Where there's no answer, it's how close your profile and the posting are as embeddings. For a new account without either, it's how well your degree's words match the posting.
- **Freshness** fades from new to zero over 30 days.
- With several fields picked, the best matches take turns between them, so one big field doesn't bury the others.

The full details, including how the embeddings are made, are in the [feed contract](/feed-contract#how-the-feed-ranks).

## What the scores can't know

The scores only see the posting's text and what you gave Agisse. They can't know:

- how many people applied, or whether someone inside already has the job;
- what the hiring team wants beyond what the posting says;
- experience that isn't in your CV or profile;
- real pay when the posting doesn't state it;
- whether the posting is still open, beyond the date it was last seen.

A model can also be wrong. The 1–5 score shows each requirement and the CV evidence behind it, so you can check it. You decide whether to apply.
