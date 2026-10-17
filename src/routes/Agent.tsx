import { useState } from 'react'
import { Link } from 'wouter'
import { CalendarClock, CalendarPlus, Check, ChevronRight, Copy, Inbox, Sparkles, Sunrise, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import posthog from '../lib/posthog'

const MCP_URL = 'https://agisse.xyz/mcp'

// Mirrors the "Connect agent" prompt in docs/mcp.md.
const SETUP_PROMPT = `Connect me to the Agisse MCP server.

- Endpoint: ${MCP_URL} (remote server, streamable HTTP transport)
- Auth: OAuth 2.1 with dynamic client registration. Discovery metadata is at
  https://agisse.xyz/.well-known/oauth-protected-resource and
  https://agisse.xyz/.well-known/oauth-authorization-server. No API key exists;
  do not ask me for one.

Add a server named "agisse" pointing at that URL to your MCP configuration,
using your own CLI or config file (for Claude Code: \`claude mcp add --transport
http agisse ${MCP_URL}\`). Then start the OAuth flow and give me the
sign-in link. I sign in with my Agisse account and confirm the consent screen.

When connected, call \`list_board\` to confirm it works and show me the result.
If you get a 403 "This account is not approved for MCP access", stop and tell
me: my account was declined, there is nothing to fix on your side.`

type Recipe = { id: string; icon: LucideIcon; title: string; detail: string; needs: string; prompt: string }

/** Recurring tasks the seeker's own agent runs with the Agisse tools plus its own mail and calendar access. */
const RECIPES: Recipe[] = [
  {
    id: 'inbox-status',
    icon: Inbox,
    title: 'Move jobs along from your inbox',
    detail: 'Rejections, test invites, interview invites and offers update the job’s status.',
    needs: 'Agisse and your email',
    prompt: `Every morning, check my email from the last 24 hours for replies to job applications.

1. Call Agisse \`list_board\` to get my tracked jobs.
2. For each email from a company on that list, decide what it says: an online test
   (assessment), an interview invite (interview), an offer (offer) or a rejection (rejected).
   Skip newsletters, job alerts and automatic "we received your application" mails.
3. Call \`update_job_status\` with that status and \`expectedStatus\` set to the job's
   current status. When the email gives a date (test deadline, interview time,
   offer reply-by), pass it as \`date\` in ISO format with my time zone.
4. Never move a job backwards, and never reply to or delete an email.

Finish with one line per change: company, old status → new status, and why.`,
  },
  {
    id: 'calendar',
    icon: CalendarPlus,
    title: 'Interviews and tests in your calendar',
    detail: 'Each interview, test deadline and offer reply-by becomes an event, with the prep link.',
    needs: 'Agisse and your calendar',
    prompt: `Every morning, keep my calendar in step with my job search.

1. Call Agisse \`list_board\` and take every job in status interview, assessment or
   offer that has a \`nextAt\` date.
2. For each, look for an event on that day with the company name in the title.
   If there is none, create one:
   - interview: "Interview: <company> – <role>", at that time, 1 hour
   - assessment: "Online test due: <company>", an all-day event on the deadline
   - offer: "Reply to <company>'s offer", an all-day event on the reply-by date
   Put https://agisse.xyz/jobs/<id>/prepare in the description.
3. Add a 30-minute "Prepare for <company>" block the day before each interview,
   at a time I have free.
4. Never move or delete an event you did not create.

Finish with the events you added.`,
  },
  {
    id: 'deadlines',
    icon: CalendarClock,
    title: 'Application deadlines in your agenda',
    detail: 'Saved roles get an apply-by reminder two days before they close.',
    needs: 'Agisse and your calendar',
    prompt: `Every Monday, put my application deadlines in my calendar.

1. Call Agisse \`list_board\` with status saved, then with status evaluated.
2. For each job with a \`nextAt\` date in the next 30 days, make sure my calendar has an
   all-day event "Apply: <company> – <role>" two days before that date, with
   https://agisse.xyz/jobs/<id>/apply in the description. Don't add it twice.

Finish with the deadlines in date order.`,
  },
  {
    id: 'brief',
    icon: Sunrise,
    title: 'A morning brief',
    detail: 'Follow-ups due, what is coming up this week and one role worth applying to.',
    needs: 'Agisse only',
    prompt: `Every weekday at 8:00, send me a short brief on my job search.

1. Call Agisse \`list_due_followups\`: who and which applications are due a follow-up today.
2. Call \`list_board\`: anything with a \`nextAt\` in the next 7 days (deadlines, tests,
   interviews, offer replies), soonest first.
3. Call \`list_vacancies\` with sort "match" and pick the one role that fits best
   which is not on my board yet. Say why in one line.

Keep it under 10 lines. Don't change anything in Agisse.`,
  },
  {
    id: 'scout',
    icon: Sparkles,
    title: 'New roles, checked for you',
    detail: 'Your AI reads the best new matches, scores them against your CV and saves the good ones.',
    needs: 'Agisse only',
    prompt: `Twice a week, find new roles worth my time.

1. Call Agisse \`list_vacancies\` with sort "new" and take the 10 best fits not on my board.
2. For each, read the posting at its url and call \`get_seeker_brief\` with its text.
   Evaluate it by that rubric and output schema.
3. Save only the ones scoring 4.0 or higher with \`add_job\`.

Finish with what you saved, each with its score and one line on why.`,
  },
]

/** Connect your AI: the setup prompt, then recurring tasks to hand it. Agisse itself never reads mail or calendars. */
export function AgentRoute() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600)
      posthog.capture(id === 'setup' ? 'mcp_prompt_copied' : 'agent_recipe_copied', { recipe: id })
    } catch {
      setCopied(null)
    }
  }
  const copyButton = (id: string, text: string, label: string) => (
    <Button variant="outline" size="sm" className="shrink-0 max-md:h-11" onClick={() => void copy(id, text)} aria-live="polite">
      {copied === id ? <Check data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
      {copied === id ? 'Copied' : label}
    </Button>
  )

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-10 px-4 pt-6 pb-24 md:px-10 md:pt-10">
      <header className="flex flex-col gap-2 px-1">
        <h1 className="m-0 text-[28px] leading-tight font-semibold tracking-tight text-balance md:text-[32px]">Connect your AI</h1>
        <p className="m-0 max-w-[60ch] text-[17px] leading-relaxed text-pretty text-muted-foreground">
          Claude, ChatGPT or any assistant that speaks MCP can read and update your jobs in Agisse. Give it your email and calendar too, and it can keep both in step
          with your search while you get on with applying. Agisse itself never reads your mail.
        </p>
      </header>

      <section aria-labelledby="connect-title" className="flex flex-col gap-3">
        <h2 id="connect-title" className="m-0 px-1 text-[15px] font-semibold tracking-tight">
          1. Connect
        </h2>
        <ol className="m-0 flex list-none flex-col overflow-hidden rounded-2xl bg-card p-0 ring-1 ring-foreground/10">
          <li className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5">
            <span className="min-w-0 flex-1 basis-56 text-[15px]">
              <span className="font-medium">Claude Code, Codex or Cursor:</span> <span className="text-muted-foreground">paste this prompt and it sets itself up.</span>
            </span>
            {copyButton('setup', SETUP_PROMPT, 'Copy setup prompt')}
          </li>
          <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <span className="min-w-0 flex-1 basis-56 text-[15px]">
              <span className="font-medium">Claude or ChatGPT in the browser:</span>{' '}
              <span className="text-muted-foreground">
                add a custom connector in Settings with <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] text-foreground">{MCP_URL}</code>
              </span>
            </span>
            {copyButton('url', MCP_URL, 'Copy URL')}
          </li>
        </ol>
        <p className="m-0 px-1 text-sm text-pretty text-muted-foreground">You sign in with your Agisse account and approve. No API key, and you can remove the connection from your agent any time.</p>
      </section>

      <section aria-labelledby="tasks-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 px-1">
          <h2 id="tasks-title" className="m-0 text-[15px] font-semibold tracking-tight">
            2. Give it a recurring task
          </h2>
          <p className="m-0 text-sm text-pretty text-muted-foreground">
            Copy one, paste it into your agent and say “run this on a schedule”: a scheduled task in Claude, Tasks in ChatGPT, <code className="text-[0.85em]">/schedule</code> in Claude Code.
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-2xl bg-card p-0 ring-1 ring-foreground/10">
          {RECIPES.map((r) => (
            <li key={r.id} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-start gap-3 px-4 pt-3.5 pb-2 sm:flex-nowrap">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-[18px]">
                  <r.icon />
                </span>
                <span className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
                  <span className="text-[15px] font-medium">{r.title}</span>
                  <span className="text-[13px] text-pretty text-muted-foreground">{r.detail}</span>
                  <span className="text-[12px] text-muted-foreground/80">Needs {r.needs}</span>
                </span>
                {copyButton(r.id, r.prompt, 'Copy')}
              </div>
              <details className="group px-4 pb-3">
                <summary className="ml-12 flex min-h-9 w-fit cursor-pointer list-none items-center gap-1 text-[13px] text-muted-foreground outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  See the prompt
                  <ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" aria-hidden="true" />
                </summary>
                <pre className="mt-1 ml-12 overflow-x-auto rounded-xl bg-muted p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-foreground">{r.prompt}</pre>
              </details>
            </li>
          ))}
        </ul>
        <p className="m-0 px-1 text-sm text-pretty text-muted-foreground">
          Every status your agent changes shows in the job’s history and on <Link href="/" className="text-primary underline-offset-4 hover:underline">Today</Link>. Change the
          prompts as you like; the tools are listed in the <a href="/docs/mcp" className="text-primary underline-offset-4 hover:underline">docs</a>.
        </p>
      </section>
    </main>
  )
}
