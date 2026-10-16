// The opt-in Monday email: tracked roles closing this week, and tests, interviews and offer replies due. No model calls.
import { and, eq, gte, inArray, lt } from 'drizzle-orm'
import { schema, type Db } from '../db'
import type { JobStatus } from '../../shared/types'
import { sendEmail } from './email'

const DAY = 86_400_000

// What the date means at each status (NEXT_AT_LABEL); other statuses have no date the seeker can miss.
const DUE: Partial<Record<JobStatus, string>> = { saved: 'closes', evaluated: 'closes', assessment: 'test due', interview: 'interview', offer: 'reply by' }

export type DueJob = { id: string; role: string; company: string; status: JobStatus; nextAt: Date | null; closedAt: Date | null }

/** Monday to Sunday (UTC) of the week `now` falls in, when `now` is a Monday. Deadlines are stored at 12:00 UTC, so a day never slips. */
export const thisWeek = (now: Date) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return { start, end: new Date(start.getTime() + 7 * DAY) }
}

/** The lines for one seeker, soonest first: role · employer · closes Thu 23 Oct. A role its board already dropped is left out. */
export function dueThisWeek(jobs: DueJob[], now: Date) {
  const { start, end } = thisWeek(now)
  return jobs
    .filter((j) => DUE[j.status] && j.nextAt && j.nextAt >= start && j.nextAt < end && !(j.closedAt && (j.status === 'saved' || j.status === 'evaluated')))
    .sort((a, b) => a.nextAt!.getTime() - b.nextAt!.getTime())
    .map((j) => ({ id: j.id, text: `${j.role} · ${j.company} · ${DUE[j.status]} ${day(j.nextAt!)}` }))
}

// Thu 23 Oct, on the clock the seekers live by.
const day = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' })

// ---- Unsubscribe: an HMAC of the user id, so the link works without signing in and can't be made for someone else ----

const hmacKey = (secret: string) => crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
const message = (userId: string) => new TextEncoder().encode(`unsubscribe:${userId}`)

export async function unsubscribeToken(secret: string, userId: string) {
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), message(userId)))
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function validUnsubscribe(secret: string, userId: string, token: string) {
  try {
    const sig = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    return await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, message(userId))
  } catch {
    return false
  }
}

export const unsubscribeUrl = async (env: Pick<Env, 'APP_URL' | 'BETTER_AUTH_SECRET'>, userId: string) =>
  `${env.APP_URL}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${await unsubscribeToken(env.BETTER_AUTH_SECRET, userId)}`

// The daily cron sends only on Mondays. Without RESEND_API_KEY or APP_URL nothing goes out.
// ponytail: 50 emails a run stays inside Resend's free 100 a day next to sign-up mail; past 50 seekers with dates this week,
// the rest miss that Monday. Raise the cap with a paid plan, or send in batches over the day.
export async function sendDeadlineEmails(env: Env, db: Db, now = new Date()) {
  if (now.getUTCDay() !== 1 || !env.RESEND_API_KEY || !env.APP_URL) return 0
  const { start, end } = thisWeek(now)
  const rows = await db
    .select({ userId: schema.user.id, email: schema.user.email, id: schema.job.id, role: schema.job.role, company: schema.job.company, status: schema.job.status, nextAt: schema.job.nextAt, closedAt: schema.job.closedAt })
    .from(schema.job)
    .innerJoin(schema.user, eq(schema.user.id, schema.job.userId))
    .where(and(eq(schema.user.deadlineEmail, true), inArray(schema.job.status, Object.keys(DUE) as JobStatus[]), gte(schema.job.nextAt, start), lt(schema.job.nextAt, end)))
    .orderBy(schema.job.userId)
    .limit(2000)
  const byUser = new Map<string, typeof rows>()
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r])
  let sent = 0
  for (const [userId, jobs] of byUser) {
    if (sent >= 50) break
    const items = dueThisWeek(jobs, now)
    if (!items.length) continue
    const lines = ['In your tracker this week:', ...items.map((i) => ({ text: i.text, href: `${env.APP_URL}/jobs/${i.id}` }))]
    if (await sendEmail(env, jobs[0]!.email, items.length === 1 ? 'One date this week' : `${items.length} dates this week`, lines, { label: 'Open your tracker', url: `${env.APP_URL}/jobs?view=track` }, await unsubscribeUrl(env, userId))) sent++
  }
  return sent
}
