# Security

Agisse holds people's CVs and job searches, so we take reports seriously.

## Reporting a vulnerability

Email **hello@agisse.xyz** with "Security" in the subject, or use GitHub's private vulnerability reporting on this repository. Please don't open a public issue.

Include what you found, how to reproduce it, and what an attacker could do with it. We'll confirm receipt within 3 working days and keep you posted until it's fixed. We're happy to credit you once the fix is live.

## Scope

The code in this repository and the hosted service at agisse.xyz. Testing against agisse.xyz must not touch other users' data or degrade the service; create your own account for it.

## Supported versions

Only the latest `main` is supported. Self-hosters should stay current.

## If personal data leaks

This is the runbook for agisse.xyz. Lennart Steen runs agisse.xyz and is the data controller, so he decides each step. If you run your own copy, you are the controller of it: use your own data protection authority and your own contacts.

1. **Stop it.** Close the hole first (revert, take the route down, revoke access), then rotate what may be exposed: `DATABASE_URL` (a new Neon password), the R2 and Cloudflare API tokens, `OPENROUTER_API_KEY`, `EXA_API_KEY`, `RESEND_API_KEY`, `SENTRY_DSN`. Rotating `BETTER_AUTH_SECRET` signs everyone out and makes saved own AI keys unreadable (they're encrypted with it), so users have to reconnect them. Do it if the database or the secret leaked.
2. **Write it down.** Note what happened, when you found out, which data and how many people, and what you did. GDPR art. 33(5) asks for a record of every breach, including the ones you don't report.
3. **Tell the authority within 72 hours** of finding out, unless the breach is unlikely to put anyone at risk: the Belgian Data Protection Authority (GBA/APD), through its online form at [dataprotectionauthority.be](https://www.dataprotectionauthority.be). If you don't know everything yet, report what you know and add the rest later.
4. **Tell the people affected** without delay when the risk to them is high, for example when CVs, notes or own AI keys were exposed. Email them plainly: what happened, which of their data, what we did, and what they should do (revoke their AI key at the provider, watch for phishing).
5. **Fix and follow up.** Add a check that would have caught it, and once it's fixed, say what happened in the changelog.
