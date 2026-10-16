---
title: Record of processing
description: The GDPR article 30 record for agisse.xyz. One table of what is processed, for whom, by whom, and for how long.
---

# Record of processing (GDPR article 30)

This is the record for agisse.xyz. A self-hosted copy has its own controller, who keeps their own record; this one can serve as a starting point. The [privacy policy](/privacy) is the text for users and the [data flow](/data-flow) page shows the code paths. Where they and this record disagree, the open points are tracked in [#148](https://github.com/Agisse/agisse/issues/148).

## Controller

| | |
|---|---|
| Controller | Lennart Steen, who runs Agisse as a private person (no company) |
| Contact | [hello@agisse.xyz](mailto:hello@agisse.xyz) |
| Representative / DPO | None appointed (not required: no large-scale processing of special categories, no public authority) |
| Supervisory authority | Gegevensbeschermingsautoriteit / Autorité de protection des données (Belgium) |
| Last reviewed | 16 October 2026 |

## Activities

Data subjects are Agisse's users (students and early-career job seekers, minimum age 18) unless the row says otherwise. Recipients are the processors listed in the privacy policy.

| Activity | Purpose | Personal data | Legal basis | Recipients | Outside the EEA | Retention |
|---|---|---|---|---|---|---|
| Accounts and sign-in | Let users in, run the waitlist and invites | Name, email, password hash, Google link, sessions, waitlist status, referral and invite codes | Contract | Cloudflare, Neon, Google (if chosen), Resend | Google, Resend (USA) | Account lifetime; waitlist accounts unused for 12 months are deleted; other accounts unused for 24 months are emailed once and deleted 30 days later |
| Job-search workspace | The product: profile, CV, tracker, prep, saved companies and programmes, assistant memories | CV (PDF and text), education, work history, preferences, saved postings, notes, drafts, practice answers | Contract | Cloudflare (R2, EU jurisdiction), Neon (Frankfurt) | No | Account lifetime; deleted with the account |
| AI features | Evaluate postings, tailor CVs, draft messages, prep, at the user's request | The CV and profile text a feature needs, with contact details removed first; the posting | Contract | OpenRouter and the model providers it routes to (by default Mistral AI, EU endpoint only; tailored CVs go to free models from other providers); with an own key or a connected ChatGPT plan, that provider instead | Yes (USA and others), under OpenRouter's DPA and the Standard Contractual Clauses | Not stored by Agisse beyond the usage log; providers per their policy |
| ChatGPT plan | Run a user's AI requests on their own ChatGPT Plus or Pro plan, at their request (off on agisse.xyz until OpenAI admits it; on in `npx agisse`) | OAuth tokens (access, refresh, client id), sealed with AES-GCM; the ChatGPT account's name, shown in Profile; the CV and profile text a feature needs, with contact details removed first | Contract | OpenAI, under the user's own ChatGPT account and OpenAI's terms | Yes (USA), under the user's own agreement with OpenAI | Until Disconnect or account deletion, which also revoke the session at OpenAI; deleted when OpenAI refuses the refresh token (30 days unused) |
| People search | Suggest whom to contact at a company | Third parties: names, roles and public profile links of people at companies | Legitimate interest | Exa, Neon | Exa (USA) | With the searching user's account; cached search results deleted after 7 days |
| Feed ranking | Order the job feed by fit | A profile embedding and a fit score per role, derived from the profile | Contract | The feed provider (run by the controller), Neon | No | Account lifetime; deleted with the account |
| Outcome figures | Show users anonymous response rates and timelines per employer, on the posting | Tracker status changes and their dates, counted over the past 12 months as of each Monday; a figure only with at least 10 users behind it, counts as bands, rates rounded to 5% | Legitimate interest; opt-out in Profile | Neon | No | Account lifetime; left out once the user opts out or deletes the account |
| Test reports | When a job moves to Online test, an optional "Which test?": show other students which publisher an employer uses, as counts | The user, the job, the employer and the chosen publisher (or none for Not sure or Skip); shown only as "reported by N students", once at least 2 students reported the same publisher in 12 months, never with a name | Contract (the user chooses to answer); opt-out in Profile for the counts | Neon | No | Deleted with the job or the account; counted for 12 months; left out once the user opts out |
| Usage and quality | Fair-use limits, cost control, answer quality | Feature, model, tokens, cost, the model's output, the user's rating and note | Legitimate interest | Neon | No | The output, the note: 90 days; the rest: account lifetime |
| Account email | Password resets and account notices | Email address, message | Contract | Resend | Yes (USA) | Per Resend's policy |
| Deadline email | Monday email, opt-in, listing the tracker's dates in that week | The on/off choice; the email sends the address and the roles, employers and dates due | Consent; off by default, withdrawn in Profile or by the unsubscribe link | Resend, Neon | Resend (USA) | The choice: account lifetime, off when withdrawn; nothing else is stored; the email per Resend's policy |
| Analytics and error reports | Learn which features help; fix bugs | Account id, pages viewed (addresses without query strings or ids), features used, technical error details | Legitimate interest | PostHog, Sentry | Sentry (USA); PostHog in the EU | At most 12 months; PostHog's are deleted with the account |
| Maps and logos | Show roles on a map and company logos | Location text, company domain, IP address (sent by the browser) | Legitimate interest | Nominatim, OpenFreeMap, logo.dev | Nominatim (UK), logo.dev (USA) | Per their policies |
| Bot protection | Stop automated sign-ups | IP address, browser signals | Legitimate interest | Cloudflare Turnstile | Per Cloudflare's network | Per Cloudflare's policy |

Agisse doesn't ask for special categories of data (GDPR article 9) and doesn't score on them. Users are told at upload to leave out their photo, date of birth and anything they wouldn't tell an employer. Scores are advice; the user decides and acts, so there is no automated decision under article 22.

## AI processing of CVs (impact note)

A short assessment in the spirit of a DPIA (article 35). The controller decided (16 October 2026) that this short assessment is enough for now; a full DPIA follows before processing grows in scale, for example when a university or campus joins.

- **What's processed:** the CV and profile text a feature needs, and the posting, sent to a language model when the user asks for an evaluation, a tailored CV, a draft or prep. Contact details are removed before the call and put back afterwards. Nothing is sent without the user's action.
- **Risks:** the model states something about the user that isn't true; it weighs age, gender, nationality, health or a photo; the text leaks through a provider that keeps or trains on it; a posting carries instructions that steer the model.
- **Mitigations:** prompts tell the model to use only the facts it's given and never those personal traits (the second is checked in code); contact details are removed first; on agisse.xyz's key, OpenRouter's account setting refuses providers that train on prompts; model output is shown as text, never run as code, and its links must be http(s); a user's AI requests can only read that user's data.
- **No automated decision:** a score is advice. The user reads it, decides and acts themselves; Agisse never applies or sends a message for them (article 22 doesn't apply).
- **Residual risk:** a wrong or unfair statement can still slip through. Users can rate an answer and say why; the ratings show on the admin's quality page.

## Security measures (article 32)

- TLS everywhere, with HSTS; a Content Security Policy on the app's pages.
- Every route that returns user data checks that it belongs to the signed-in account (tested in CI with two accounts).
- Own AI keys are sealed with AES-GCM and never sent back to the browser.
- Contact details are removed from CV text before it reaches a model.
- The CV PDF is checked to be a PDF and kept privately; no URL serves it.
- Delete account removes the account's rows (by foreign-key cascade), the CV file, and the MCP sign-in tokens and consents; `worker/index.check.ts` checks that nothing with the account's id is left.
- Admin views show account-level facts, not CVs or messages. The quality page shows the first 200 characters of users' rating notes, without an account id; notes are deleted after 90 days.
- A breach runbook is in [`SECURITY.md`](https://github.com/Agisse/agisse/blob/main/SECURITY.md).
