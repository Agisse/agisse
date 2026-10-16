// Outcome figures per employer: how far other seekers' applications got, from their trackers (MOAT-AI.md step 2).
// Anonymous by construction: a rolling 12 months as of last Monday, at least MIN_USERS people, rates rounded to 5%, counts as bands.
// Built on read from `job` rows (worker/lib/quality.ts employerOutcomes); seekers who turned off counting are left out.
import { countsTracker } from './quality'
import type { StatusChange } from './types'

export type OutcomeStats = {
  /** How many people applied, as a band. */
  applied: '10+' | '20+' | '50+'
  /** Share that reached each stage, in whole percent rounded to 5. */
  test: number
  interview: number
  offer: number
  /** Median days from applying to the first reply (a next step or a rejection); null below MIN_USERS replies. */
  replyDays: number | null
  /** The Monday the figures are as of, ISO. */
  asOf: string
}

export type OutcomeRow = { userId: string; history: StatusChange[]; appliedAt: Date | string | null; share?: boolean | null }

/** Below this many distinct people a figure is not shown. */
export const MIN_USERS = 10

const REPLIES = new Set(['responded', 'assessment', 'interview', 'offer', 'rejected'])
const DAY = 86_400_000

/** Monday 00:00 UTC on or before `now`: figures change once a week, not with every tracker move. */
export function lastMonday(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d
}

/** The start of the 12-month window ending at `asOf`. */
export function windowStart(asOf: Date) {
  const d = new Date(asOf)
  d.setUTCFullYear(d.getUTCFullYear() - 1)
  return d
}

const band = (n: number): OutcomeStats['applied'] => (n >= 50 ? '50+' : n >= 20 ? '20+' : '10+')
const round5 = (x: number) => Math.round(x * 20) * 5

/** Figures for one employer's rows, or null when fewer than MIN_USERS people applied in the window. */
export function outcomeStats(rows: OutcomeRow[], asOf: Date): OutcomeStats | null {
  const from = windowStart(asOf).getTime()
  const to = asOf.getTime()
  // One application per person: their latest in the window, with only what had happened by asOf.
  const latest = new Map<string, { applied: number; history: StatusChange[] }>()
  for (const r of rows) {
    if (!countsTracker(r.share)) continue
    const history = r.history.filter((h) => new Date(h.at).getTime() <= to)
    const at = r.appliedAt ?? history.find((h) => h.status === 'applied')?.at
    const applied = at ? new Date(at).getTime() : NaN
    if (!(applied > from && applied <= to)) continue
    const prev = latest.get(r.userId)
    if (!prev || applied > prev.applied) latest.set(r.userId, { applied, history })
  }
  const apps = [...latest.values()]
  if (apps.length < MIN_USERS) return null
  const share = (status: string) => round5(apps.filter((a) => a.history.some((h) => h.status === status)).length / apps.length)
  const days = apps
    .flatMap((a) => {
      const reply = a.history.find((h) => REPLIES.has(h.status))
      return reply ? [Math.max(0, (new Date(reply.at).getTime() - a.applied) / DAY)] : []
    })
    .sort((x, y) => x - y)
  const mid = days.length / 2
  return {
    applied: band(apps.length),
    test: share('assessment'),
    interview: share('interview'),
    offer: share('offer'),
    replyDays: days.length < MIN_USERS ? null : Math.round(days.length % 2 ? days[Math.floor(mid)]! : (days[mid - 1]! + days[mid]!) / 2),
    asOf: asOf.toISOString(),
  }
}

/** The one line on a posting's Overview: "From 20+ applicants in the past year: 35% got a test, 15% an interview · first reply in ~9 days". */
export function outcomeLine(s: OutcomeStats) {
  const offer = s.offer ? `, ${s.offer}% an offer` : ''
  const reply = s.replyDays === null ? '' : ` · first reply in ~${s.replyDays} day${s.replyDays === 1 ? '' : 's'}`
  return `From ${s.applied} applicants in the past year: ${s.test}% got a test, ${s.interview}% an interview${offer}${reply}`
}
