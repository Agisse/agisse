---
title: Agisse and career-ops
description: Agisse and career-ops side by side, from career-ops' own README. Checked 14 October 2026.
---

# Agisse and career-ops

*Checked 14 October 2026 against [career-ops' README](https://github.com/career-ops-hq/career-ops).*

[career-ops](https://github.com/career-ops-hq/career-ops) is an open-source (MIT) AI job search agent that runs on your own machine, inside an AI coding CLI. Agisse's job evaluation and CV prompts are adapted from it, with credit in [`NOTICE`](https://github.com/Agisse/agisse/blob/main/NOTICE). Think of it as a sibling for developers.

| | Agisse | career-ops |
|---|---|---|
| Runs | In the browser at agisse.xyz, or self-hosted (`npx agisse` or Cloudflare) | On your machine, in Claude Code, Codex, OpenCode and other AI CLIs |
| Setup | An account; nothing to install | Node.js, an AI CLI, `npx @santifer/career-ops init`; Playwright for PDFs |
| Finding roles | A feed of European roles ranked against your CV | A scanner over 100+ preconfigured company boards (Ashby, Greenhouse, Lever, Wellfound), or paste a job |
| Verdict | 1–5 score; below 4.0 says don't apply | 1–5 score; below 4.0 says don't apply |
| Applying | Tailored CV, cover letter and drafted form answers to copy; you submit | Tailored CV, cover letter and form answers; you press Submit |
| People | Warm intros from shared ground (university, employer, student organisation); you send the note | Finds the hiring manager, recruiter or a peer and drafts a message; you send it |
| Prep | Interview and online-assessment practice | Company prep docs, practice sessions, a story bank |
| Your data | Agisse's EU database, or your own server | Files on your machine |
| AI | Agisse's key to try it, or your own key | Your AI CLI's model, or free and local models |
| Price | Free | Free |
| License | AGPL-3.0 | MIT |

**career-ops fits you if** you already work in an AI CLI, want everything in local files, and look mostly at tech companies.

**Agisse fits you if** you want to open a web page and start, are looking in Europe in any field, and want the feed, introductions and prep in one place.
