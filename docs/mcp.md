# MCP

Agisse runs a remote MCP server so an AI client (Claude Desktop, Claude Code, ...) can read and act on one signed-in user's data — the same account as the web app, no separate API key.

## Connect

- Endpoint: `https://agisse.xyz/mcp`
- Auth: OAuth. Your client discovers the flow itself via the standard metadata Better Auth serves at `/.well-known/*`; when it prompts, sign in with your Agisse account.
- Your account must be **approved** (or the admin account) — a pending account gets a 403 with `This account is not approved for MCP access.`

Example client config (Claude Desktop / Claude Code, `~/.claude.json` or the equivalent MCP settings):

```json
{
  "mcpServers": {
    "agisse": {
      "url": "https://agisse.xyz/mcp"
    }
  }
}
```

## Connect agent

Don't want to edit config by hand? Paste this into your AI agent (Claude Code, Cursor, Codex, ...) and let it do the setup:

```text
Connect me to the Agisse MCP server.

- Endpoint: https://agisse.xyz/mcp (remote server, streamable HTTP transport)
- Auth: OAuth 2.1 with dynamic client registration. Discovery metadata is at
  https://agisse.xyz/.well-known/oauth-protected-resource and
  https://agisse.xyz/.well-known/oauth-authorization-server. No API key exists;
  do not ask me for one.

Add a server named "agisse" pointing at that URL to your MCP configuration,
using your own CLI or config file (for Claude Code: `claude mcp add --transport
http agisse https://agisse.xyz/mcp`). Then start the OAuth flow and give me the
sign-in link. I sign in with my Agisse account and confirm the consent screen.

When connected, call `list_board` to confirm it works and show me the result.
If you get a 403 "This account is not approved for MCP access", stop and tell
me: my account is still pending approval, there is nothing to fix on your side.
```

## Tools

| Tool | What it does |
| --- | --- |
| `get_profile` | Your stable account id, name and email. Read-only. |
| `get_memory` | What the user told Agisse's assistant about themselves (goals, preferences, constraints, background, style). Read-only. |
| `get_usage` | This month's AI budget (EUR): used, limit, remaining, reset date. Read-only. |
| `list_board` | List your tracked job applications (Applications), newest first. Paged; filters `status`, `company`, `since`/`until` (created). Read-only. |
| `get_board_item` | Get one job application in full (evaluation, CV, cover letter, notes). Read-only. |
| `list_searches` | List your people searches (on Contacts), newest first. Paged; filters `company`, `since`/`until` (created). Read-only. |
| `get_search` | Get one search (a company and role) and the ranked people found for it. Read-only. |
| `get_contact` | Get one person, including their outreach draft and reply status. Read-only. |
| `list_contacted` | List the people you've marked as contacted, newest first. Paged; filters `status` (reply status), `company`, `since`/`until` (contacted). Read-only. |
| `list_due_followups` | List contacted people and applied jobs due a follow-up today (7-day cadence). Read-only. |
| `draft_outreach` | Draft the first message for one contact (`rewrite: true` replaces the stored draft). Sends data to an external AI model and costs from your monthly AI budget; returns the budget before and after, the character limit it enforced (`charLimit`) and what it drew on (`research`: no live web research, only facts stored on the contact). Only drafts — never sends anything. An existing draft without `rewrite` is returned free. |
| `update_contact_status` | Update a contact's reply status or mark a follow-up sent. Optional `expectedStatus` makes it a no-op with an error if the status has changed. Returns `{ before, after }`. |
| `get_seeker_brief` | Your CV and target industries, for research and company ideation done by your own AI. With `jdText`, also the evaluation rubric and the exact output schema `add_job` expects. Read-only, free. |
| `add_job` | Save a posting to Jobs with an evaluation your own AI produced (`jdText`, optional `url`, `evaluation`). No model call, nothing charged. A posting already in Jobs comes back with `existing: true` and nothing is written. |
| `add_to_shortlist` | Save a company to target (`name`, optional `domain`, `why`). Saving the same name again updates it. No model call. |
| `list_shortlist` | List the companies on your shortlist, newest first, with why. Read-only. |
| `list_vacancies` | Your Jobs for you feed: open early-career postings in Europe, ranked for you, 30 per page (`cursor` / `nextCursor`). Each has `title`, `company`, `url`, `location`, `fit` (0–100), `reasons` (Jev's verdict first when there is one) and `deadline`. Filters (`q`, `countries`, `level`, `functions`, `industries`, `languages`, `remoteOnly`, `deadlineWithin`, `sort`) default to your saved feed filters. Read-only, no model call. |
| `update_job_status` | Move a job to another status (`applied`, `interview`, `offer`, …), as on the web. Optional `expectedStatus` makes it a no-op with an error if the status has changed. Returns `{ before, after }`. |

Every tool declares an `outputSchema` and returns its result both as JSON text and as `structuredContent`; errors come back as `isError` text.

### Paging

The three `list_*` tools take `limit` (1–100, default 50), `cursor`, `company` (case-insensitive substring), `since` (inclusive) and `until` (exclusive) as ISO dates or datetimes in UTC, and return `{ items, nextCursor, total }`. `total` counts everything matching the filters; pass `nextCursor` back unchanged for the next page, until it is `null`.

## Use your own AI

The web app evaluates postings and scouts companies with Agisse's own models, paid from your monthly AI budget. Over MCP you can do that work in the client instead, on whatever subscription it runs on, and only hand Agisse the result:

1. `get_seeker_brief` gives your CV and targets. Ask your AI to research companies or roles with its own web search and to shortlist the good ones with `add_to_shortlist`.
2. For a posting, pass its text to `get_seeker_brief`: you get the same rubric and output schema the web app uses. Your AI evaluates the posting by that rubric.
3. `add_job` stores the evaluation. The job shows up in Jobs and Applications like any other, with score and recommendation, and costs nothing from the budget.
4. Discover → track: `list_vacancies` shows your feed, your AI picks the roles worth it, evaluates them and saves them with `add_job`, then `update_job_status` moves each one along as you apply, hear back and interview.

The server makes no model call for any of these tools. `draft_outreach` is the only MCP tool that spends budget.
