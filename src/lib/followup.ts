import type { JobStatus, JobSummary, Person } from '../../shared/types'

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY

/**
 * What a contacted person still waiting on a reply needs next: one follow-up after a week
 * of silence, then "no reply" a week after that follow-up. Never a second follow-up.
 */
export function nextStep(p: Pick<Person, 'status' | 'contactedAt' | 'followedUpAt'>, now = Date.now()): 'follow up' | 'no reply' | null {
  if (p.status !== 'contacted' || !p.contactedAt) return null
  const since = p.followedUpAt ?? p.contactedAt
  if (now - Date.parse(since) < WEEK) return null
  return p.followedUpAt ? 'no reply' : 'follow up'
}

export const STALE_APPLICATION = 'No reply in 2 weeks: follow up'
export const SILENT_AFTER_FOLLOW_UP = 'Still silent after your follow-up: close it?'

/** A dated step shows from this many days ahead until a day after it passed. Tab is the posting tab that does the work. */
const DATED: Partial<Record<JobStatus, { days: number; label: string; tab: string }>> = {
  saved: { days: 3, label: 'Deadline: evaluate and apply', tab: '' },
  evaluated: { days: 3, label: 'Deadline: apply', tab: '' },
  responded: { days: 2, label: 'Next step', tab: '' },
  assessment: { days: 2, label: 'Online test due', tab: '/prepare' },
  interview: { days: 2, label: 'Interview: rehearse', tab: '/prepare' },
  offer: { days: 3, label: 'Reply to the offer', tab: '/offer' },
}

type JobIn = Pick<JobSummary, 'id' | 'status' | 'appliedAt' | 'nextAt'>
type PersonIn = Pick<Person, 'status' | 'contactedAt' | 'followedUpAt'>
/** `at` is when it fell due or happens; `href` (jobs) opens the tab that does the work. */
export type DueItem<J, P> = { kind: 'person'; person: P; label: string; at: string } | { kind: 'job'; job: J; label: string; at: string; href: string }

/**
 * What waits on the seeker, soonest first: people due a follow-up (or a close), applications silent for two weeks
 * (or for a week after the seeker followed up), and deadlines, tests, interviews and offer replies coming up.
 */
export function dueItems<J extends JobIn, P extends PersonIn>(jobs: J[], people: P[], now = Date.now()): DueItem<J, P>[] {
  const items: DueItem<J, P>[] = []
  for (const person of people) {
    const label = nextStep(person, now)
    if (label) items.push({ kind: 'person', person, label, at: new Date(Date.parse(person.followedUpAt ?? person.contactedAt!) + WEEK).toISOString() })
  }
  for (const job of jobs) {
    const base = `/jobs/${job.id}`
    if (job.status === 'applied' && job.appliedAt) {
      // A set check-back date means the seeker already followed up (or chose when to look again).
      const at = job.nextAt ? Date.parse(job.nextAt) : Date.parse(job.appliedAt) + 2 * WEEK
      if (now >= at) items.push({ kind: 'job', job, at: new Date(at).toISOString(), label: job.nextAt ? SILENT_AFTER_FOLLOW_UP : STALE_APPLICATION, href: job.nextAt ? base : `${base}/apply` })
      continue
    }
    const rule = DATED[job.status]
    if (!rule || !job.nextAt) continue
    const at = Date.parse(job.nextAt)
    if (at - now <= rule.days * DAY && now - at <= DAY) items.push({ kind: 'job', job, at: job.nextAt, label: rule.label, href: base + rule.tab })
  }
  return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
