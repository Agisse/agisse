// The one practice Prepare puts first. Pure: the Tests tab feeds it the seeker's jobs, a test lookup and their weakest area.
import type { JobStatus } from '../../../../shared/types'
import type { NextStep } from '../../../../shared/progress'
import { practiceHref } from './modes'

export type UpcomingJob = { id: string; company: string; role: string; status: JobStatus; nextAt: string | null }
/** The practisable tests an employer is known to use. */
export type KnownTests = { publisher: string | null; games: string[]; minutes: number }
export type NextPractice = { title: string; detail: string; href: string; action: string }

/** Earlier stages where getting ahead on a known test set still pays off. */
const EARLY = new Set<JobStatus>(['saved', 'evaluated', 'applied', 'responded'])
const DAY = 86_400_000

const inDays = (at: string | null, now: number) => {
  if (!at) return null
  const d = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY)
  return d < 0 ? null : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
}
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const testsLine = (t: KnownTests) => `${t.publisher ? `They use ${t.publisher}. ` : ''}About ${t.minutes} min.`

const DRILL: NextPractice = { title: 'Daily drill', detail: 'A few minutes on your weakest skills, getting harder as you improve.', href: practiceHref(null, 'drill'), action: 'Start the drill' }
const STEP: Record<NextStep['area'], Pick<NextPractice, 'title' | 'action' | 'href'>> = {
  games: { title: 'Drill your weakest skill', action: 'Start the drill', href: '' },
  answers: { title: 'Practise an interview answer', action: 'Practise an interview', href: '/prepare/interviews' },
  cv: { title: 'Fix your CV', action: 'Review my CV', href: '/prepare/cv' },
}

/**
 * What to practise next, most pressing first:
 * a test or interview the seeker has coming up (soonest date first), then a known test set for an earlier application,
 * then their weakest area (`weakest`, from nextSteps), then the daily drill.
 */
export function nextPractice(jobs: UpcomingJob[], testsFor: (company: string) => KnownTests | null, weakest: NextStep | null, now = Date.now()): NextPractice {
  const live = jobs.filter((j) => j.status === 'assessment' || j.status === 'interview').sort((a, b) => (a.nextAt ?? '9').localeCompare(b.nextAt ?? '9'))
  const j = live[0]
  if (j) {
    const when = inDays(j.nextAt, now)
    if (j.status === 'interview')
      return { title: `Rehearse your ${j.company} interview`, detail: `${when ? `${sentence(when)}. ` : ''}Questions for ${j.role}.`, href: `/prepare/interviews?job=${encodeURIComponent(j.id)}`, action: 'Practise the interview' }
    const tests = testsFor(j.company)
    const due = when ? `Test due ${when}. ` : ''
    return tests
      ? { title: `Practise ${j.company}'s tests`, detail: `${due}${testsLine(tests)}`, href: practiceHref(j.id, 'practice', tests.games), action: `Start ${j.company} practice` }
      : { title: `Get ready for ${j.company}'s test`, detail: `${due}Agisse doesn't know which test they use yet. The daily drill trains the common skills.`, href: DRILL.href, action: DRILL.action }
  }
  for (const e of jobs) {
    if (!EARLY.has(e.status)) continue
    const tests = testsFor(e.company)
    if (tests) return { title: `Get ahead on ${e.company}'s tests`, detail: testsLine(tests), href: practiceHref(e.id, 'practice', tests.games), action: `Start ${e.company} practice` }
  }
  if (weakest) return { ...STEP[weakest.area], detail: weakest.text, ...(weakest.area === 'games' ? { href: weakest.href } : {}) }
  return DRILL
}
