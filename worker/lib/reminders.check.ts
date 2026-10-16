// Run: npx tsx worker/lib/reminders.check.ts (no database: the query is faked). SAMPLE_EMAIL=out.html also writes the rendered email.
import { writeFileSync } from 'node:fs'
import { dueThisWeek, sendDeadlineEmails, unsubscribeToken, validUnsubscribe, type DueJob } from './reminders.ts'

const fail = (msg: string) => {
  throw new Error(msg)
}
const monday = new Date('2026-10-19T04:17:00Z')
// Deadlines are stored at 12:00 UTC (worker/index.ts saveJob); interviews carry their own time.
const job = (id: string, status: DueJob['status'], nextAt: string | null, closedAt: string | null = null): DueJob => ({ id, role: `Role ${id}`, company: `Co ${id}`, status, nextAt: nextAt ? new Date(nextAt) : null, closedAt: closedAt ? new Date(closedAt) : null })

// Which items: Monday through Sunday, soonest first; past, next-Monday, dateless, closed and statusless dates stay out.
{
  const items = dueThisWeek(
    [
      job('thu', 'saved', '2026-10-22T12:00:00Z'),
      job('mon', 'evaluated', '2026-10-19T12:00:00Z'),
      job('sun-late', 'interview', '2026-10-25T21:30:00Z'), // 23:30 in Brussels, still Sunday
      job('next-mon', 'saved', '2026-10-26T12:00:00Z'),
      job('last-week', 'saved', '2026-10-18T12:00:00Z'),
      job('none', 'saved', null),
      job('closed', 'saved', '2026-10-21T12:00:00Z', '2026-10-17T04:17:00Z'),
      job('applied', 'applied', '2026-10-21T12:00:00Z'), // a check-back date, not a deadline
      job('test', 'assessment', '2026-10-20T12:00:00Z'),
    ],
    monday,
  )
  const got = items.map((i) => i.id).join(',')
  if (got !== 'mon,test,thu,sun-late') fail(`selection: ${got}`)
  if (items[2]!.text !== 'Role thu · Co thu · closes Thu 22 Oct') fail(`line: ${items[2]!.text}`)
  if (items[3]!.text !== 'Role sun-late · Co sun-late · interview Sun 25 Oct') fail(`timezone: ${items[3]!.text}`)
  if (dueThisWeek([], monday).length) fail('empty list')
}

// Unsubscribe token: valid for its own user only, garbage never throws.
{
  const t = await unsubscribeToken('secret-a', 'user-1')
  if (!(await validUnsubscribe('secret-a', 'user-1', t))) fail('token: own user rejected')
  if (await validUnsubscribe('secret-a', 'user-2', t)) fail('token: other user accepted')
  if (await validUnsubscribe('secret-b', 'user-1', t)) fail('token: other secret accepted')
  if (await validUnsubscribe('secret-a', 'user-1', '!!not base64')) fail('token: garbage accepted')
  if (await validUnsubscribe('secret-a', 'user-1', '')) fail('token: empty accepted')
}

// Sending: Mondays only, nothing for a seeker whose dates all fall out, one email with the headers for the rest.
{
  const sent: { headers?: Record<string, string>; subject: string; html: string; text: string; to: string }[] = []
  globalThis.fetch = (async (_url: string, init: RequestInit) => (sent.push(JSON.parse(String(init.body))), new Response('{}'))) as typeof fetch
  const rows = [
    { userId: 'u1', email: 'one@example.com', ...job('a1', 'saved', '2026-10-23T12:00:00Z') },
    { userId: 'u1', email: 'one@example.com', ...job('a2', 'interview', '2026-10-20T08:30:00Z') },
    { userId: 'u2', email: 'two@example.com', ...job('b1', 'saved', '2026-10-21T12:00:00Z', '2026-10-17T04:17:00Z') },
  ]
  const query = { select: () => query, from: () => query, innerJoin: () => query, where: () => query, orderBy: () => query, limit: async () => rows }
  const db = query as unknown as Parameters<typeof sendDeadlineEmails>[1]
  const env = { RESEND_API_KEY: 're_test', APP_URL: 'https://agisse.xyz', BETTER_AUTH_SECRET: 'secret-a' } as Env
  if ((await sendDeadlineEmails(env, db, new Date('2026-10-20T04:17:00Z'))) !== 0 || sent.length) fail('sent on a Tuesday')
  if ((await sendDeadlineEmails({ ...env, RESEND_API_KEY: undefined }, db, monday)) !== 0) fail('sent without Resend')
  if ((await sendDeadlineEmails(env, db, monday)) !== 1 || sent.length !== 1) fail(`expected one email, got ${sent.length}`)
  const mail = sent[0]!
  if (mail.to !== 'one@example.com' || mail.subject !== '2 dates this week') fail(`mail: ${mail.to} ${mail.subject}`)
  const unsub = mail.headers?.['List-Unsubscribe'] ?? ''
  if (!unsub.startsWith('<https://agisse.xyz/api/unsubscribe?u=u1&t=') || mail.headers?.['List-Unsubscribe-Post'] !== 'List-Unsubscribe=One-Click') fail(`headers: ${JSON.stringify(mail.headers)}`)
  if (!mail.text.includes('Role a2 · Co a2 · interview Tue 20 Oct: https://agisse.xyz/jobs/a2')) fail(`text: ${mail.text}`)
  if (/<img/i.test(mail.html)) fail('tracking pixel')
  if (process.env.SAMPLE_EMAIL) writeFileSync(process.env.SAMPLE_EMAIL, mail.html)
}

console.log('reminders: ok')
