---
title: Privacy policy
description: What Agisse collects, why, who processes it and how to exercise your rights under the GDPR.
---

# Privacy policy

_Last updated: 15 October 2026_

Agisse is in beta; full access is by invite. You must be at least 18 to use it. This policy explains what personal data we hold, why, who helps us process it, and what you can do about it. We keep it short; write to [hello@agisse.xyz](mailto:hello@agisse.xyz) with any question.

## What we hold

| Data | What it is | Why |
|---|---|---|
| Account | Name, email, sign-in method (Google or email and password), waitlist position, referral and invite codes | To let you in and run the waitlist |
| Profile | Education, work history, skills, interests, job preferences, standard answers you save, and what you ask the assistant to remember | To rank roles and people against your background |
| CV | The PDF you upload, stored in Cloudflare R2 in the EU, and the text read from it | To fill your profile, score postings and tailor your CV |
| Searches | Companies, roles and locations you search for, and the results | To show and reuse your results |
| Contacts found | Names, roles and public profile links of people at a company, found on the public web | To suggest who to contact; you decide whether to |
| Job tracker | Postings you save, their status, dates, notes, drafts and practice answers | To run your application board |
| AI usage logs | Which AI feature ran, when, the model, token counts and cost; what it wrote, and your thumbs up or down and note on it | To enforce fair-use limits, control cost and check the quality of answers |
| Analytics | Pages viewed and buttons clicked, with your account id (never your name or email), without cookies | To learn which parts of Agisse help |
| Error reports | Technical details when something breaks, without your account id | To fix bugs |

We never sell your data and never use it to advertise to you.

**About the people Agisse finds.** Contacts come from publicly available web pages. We store only what is needed to show them to the user who searched. Anyone who finds themselves in Agisse can ask us to remove their data at [hello@agisse.xyz](mailto:hello@agisse.xyz).

## Legal bases (GDPR article 6)

- **Contract** (6(1)(b)): your account, profile, CV, searches, tracker and the AI features you ask for.
- **Legitimate interest** (6(1)(f)): cookieless analytics, error reports, fair-use limits and abuse prevention, and showing publicly available professional information about people at companies you target. We weigh these against your interests and keep them minimal.

## Who processes it for us

| Processor | Role | Where |
|---|---|---|
| Cloudflare | Hosting, CV file storage (R2), network | CV files in the EU; the network is global |
| Neon | Postgres database | EU (Frankfurt, Germany) |
| OpenRouter | Routes AI requests to model providers (such as Anthropic, OpenAI, Google, Mistral and others) | USA and other countries |
| Exa | Web search for companies, people and postings | USA |
| Nominatim (OpenStreetMap Foundation) | Turns job locations into map points; your browser sends it the location text and your IP address | UK |
| OpenFreeMap | Map tiles for the world map; your browser sends it your IP address | Hungary (EU); may be delivered through Cloudflare's network |
| logo.dev | Company logos; your browser sends it the company's domain or name and your IP address | USA |
| PostHog | Product analytics and browser error reports, cookieless | EU |
| Resend | Sending email from hello@agisse.xyz | USA |
| Google | Sign in with Google, if you choose it | USA |
| Sentry | Error reports | USA |

Where a processor offers one, it works under a data processing agreement. Some are outside the European Economic Area. Where they are, transfers rely on the EU–US Data Privacy Framework or the European Commission's Standard Contractual Clauses. If you connect your own OpenAI, Anthropic, Google or Mistral key, your AI requests go straight to that provider under your own agreement with them, not through OpenRouter. An own OpenRouter key goes through OpenRouter under your own account. What we send to an AI model is limited to what the feature needs, for example your CV text and a posting when you ask for an evaluation. Contact details in your CV (email address, phone number, birth date, street address and national ID number) are taken out before it is sent, where Agisse recognises them, and put back in the answer afterwards. Your name stays in, because drafts are signed with it.

Job and company lookups also query Adzuna and Wikidata with the search terms only, never your name or CV.

## Cookies

Agisse sets a sign-in cookie, and a 30-day cookie that remembers an invite or referral link until you sign up. It keeps some settings in your browser: the theme, the layout, and your assistant chats. There are no tracking cookies: analytics run without cookies or browser storage, so there is no consent banner.

## How long we keep it

- Account, profile, CV, searches, tracker and AI usage logs: as long as your account exists. They are deleted when you delete your account.
- What an AI feature wrote, and your note on it: 90 days. The rest of the usage log stays with your account.
- Assistant chats: in your browser only, until you sign out.
- Accounts unused for 24 months: we email you once, and delete the account 30 days later unless you sign in.
- Cached web search results: deleted after a week. Company facts: about a month.
- Waitlist sign-ups that never become active: deleted on request, or after 12 months of inactivity.
- Analytics and error reports: as long as the provider's retention period, at most 12 months. When you delete your account, we ask PostHog to delete the analytics tied to it. Error reports don't carry your account id.
- Backups roll over within 30 days of deletion.
- When we export or delete an account because you asked us to: a note of which account, which action and when, with no content, kept as proof that we did it.

## Your rights

You can, at any time:

- **Access** your data and get a copy (export).
- **Correct** it. Most of it you can edit yourself in Profile & settings.
- **Delete** it. Delete your account in **Profile & settings**; it removes your profile, CV and history.
- **Restrict** or **object** to processing based on legitimate interest.
- **Port** your data to another service in a common format.

Write to [hello@agisse.xyz](mailto:hello@agisse.xyz). We answer within one month.

## Complaints

If you are unhappy with how we handle your data, tell us first. You may also complain to the Belgian Data Protection Authority (Gegevensbeschermingsautoriteit / Autorité de protection des données), Drukpersstraat 35 / Rue de la Presse 35, 1000 Brussels, [dataprotectionauthority.be](https://www.dataprotectionauthority.be), or to the authority in your own EU country.

## Changes

If this policy changes in a way that matters, we will tell you by email or in the app before it takes effect.
