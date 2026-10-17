// The one card Today leads with. Pure: Dashboard feeds it the first-run step, what is due, the seeker's jobs and a test lookup.
import type { JobSummary } from '../../shared/types'
import { curatedFor, providerGame, providerName } from '../../shared/assessment-catalog'
import { DRILL, nextPractice, type KnownTests } from '../features/assessments/components/next'
import { SILENT_AFTER_FOLLOW_UP, STALE_APPLICATION, type DueItem } from './followup'

type Job = Pick<JobSummary, 'id' | 'company' | 'role' | 'status' | 'nextAt' | 'appliedAt' | 'score' | 'recommendation'>
type Person = { id: string; name: string; company: string; search: { id: string } | null }
export type Step = { done: boolean; label: string; detail: string; action: string; href: string }
/** `kind` picks the icon; `overdue` tints the detail red. */
export type TodayCard = { kind: 'step' | 'job' | 'person' | 'practice' | 'role' | 'clear'; title: string; detail: string; href: string; action: string; overdue?: boolean }

const DAY = 86_400_000
const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0)
/** "today", "tomorrow", "in 3 days", or the date; past ones are overdue. */
export function when(iso: string, now = Date.now()) {
  const days = Math.round((midnight(Date.parse(iso)) - midnight(now)) / DAY)
  const text = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 && days < 7 ? `in ${days} days` : new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return { text, overdue: days < 0 }
}

export const personHref = (p: Person) => (p.search ? `/s/${p.search.id}#p-${p.id}` : '/contacts?view=contacted')

/** A due item in the seeker's words: what to do, at which company, by when. */
export function dueCard(d: DueItem<Job, Person>, now = Date.now()): TodayCard {
  const w = when(d.at, now)
  const by = w.overdue ? `was due ${w.text}` : w.text
  if (d.kind === 'person')
    return d.label === 'follow up'
      ? { kind: 'person', title: `Follow up with ${d.person.name}`, detail: `${d.person.company} · no reply in a week`, href: personHref(d.person), action: 'Follow up', overdue: w.overdue }
      : { kind: 'person', title: `Close ${d.person.name}?`, detail: `${d.person.company} · still no reply after your follow-up`, href: personHref(d.person), action: 'Close', overdue: w.overdue }
  const { company, role, status } = d.job
  const base = { kind: 'job' as const, href: d.href, overdue: w.overdue }
  if (d.label === STALE_APPLICATION) return { ...base, title: `Follow up with ${company}`, detail: `${role} · no reply in 2 weeks`, action: 'Follow up' }
  if (d.label === SILENT_AFTER_FOLLOW_UP) return { ...base, title: `Close ${company}?`, detail: `${role} · still silent after your follow-up`, action: 'Open' }
  if (status === 'saved' || status === 'evaluated') return { ...base, title: `Apply to ${company}`, detail: `${role} · deadline ${by}`, action: 'Apply' }
  if (status === 'assessment') return { ...base, title: `${company} online test`, detail: `${role} · due ${by}`, action: 'Practise' }
  if (status === 'interview') return { ...base, title: `${company} interview`, detail: `${role} · ${by}`, action: 'Rehearse' }
  if (status === 'offer') return { ...base, title: `Reply to ${company}'s offer`, detail: `${role} · by ${by}`, action: 'Open offer' }
  return { ...base, title: `${company}: next step`, detail: `${role} · ${by}`, action: 'Open' }
}

/** An employer's practisable tests from the curated catalogue, as nextPractice needs them. */
export function knownTests(company: string): KnownTests | null {
  const c = curatedFor(company).find((x) => x.tests.length)
  if (!c) return null
  const seconds = c.tests.reduce((t, id) => t + (providerGame(id)?.realDuration ?? 600), 0)
  return { publisher: c.provider ? providerName(c.provider) : null, games: c.tests, minutes: Math.max(5, Math.round(seconds / 60)) }
}

/**
 * Today's one card, most useful first: the next first-run step, then the soonest thing due,
 * then a test to practise for one of the seeker's own applications, then the best-scored role they saved but haven't applied to.
 * Nothing at all: a way to find the next role.
 */
export function todayNext(o: { step?: Step; due: DueItem<Job, Person>[]; jobs: Job[]; testsFor?: (company: string) => KnownTests | null; now?: number }): TodayCard {
  const now = o.now ?? Date.now()
  if (o.step) return { kind: 'step', title: o.step.label, detail: o.step.detail, href: o.step.href, action: o.step.action }
  if (o.due[0]) return dueCard(o.due[0], now)
  const practice = nextPractice(o.jobs, o.testsFor ?? knownTests, null, now)
  if (practice !== DRILL) return { kind: 'practice', ...practice }
  const role = o.jobs
    .filter((j) => (j.status === 'saved' || j.status === 'evaluated') && (j.recommendation === 'apply_now' || j.recommendation === 'apply'))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  if (role) return { kind: 'role', title: `Apply to ${role.company}`, detail: `${role.role} · fit with your CV ${role.score?.toFixed(1)}/5`, href: `/jobs/${role.id}/apply`, action: 'Apply' }
  return { kind: 'clear', title: 'Nothing due', detail: 'Save a role with a deadline and it shows up here when it gets close.', href: '/jobs?view=feed', action: 'Find a role' }
}
