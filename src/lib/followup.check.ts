// Run: npx tsx src/lib/followup.check.ts
import { dueItems, nextStep, SILENT_AFTER_FOLLOW_UP, STALE_APPLICATION } from './followup.ts'

const now = Date.parse('2026-09-23T12:00:00Z')
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()
const cases: [Parameters<typeof nextStep>[0], ReturnType<typeof nextStep>][] = [
  [{ status: 'contacted', contactedAt: daysAgo(3), followedUpAt: null }, null],
  [{ status: 'contacted', contactedAt: daysAgo(7), followedUpAt: null }, 'follow up'],
  [{ status: 'contacted', contactedAt: daysAgo(10), followedUpAt: daysAgo(2) }, null],
  [{ status: 'contacted', contactedAt: daysAgo(20), followedUpAt: daysAgo(8) }, 'no reply'],
  [{ status: 'replied', contactedAt: daysAgo(20), followedUpAt: null }, null],
  [{ status: null, contactedAt: null, followedUpAt: null }, null],
]
for (const [p, want] of cases) {
  const got = nextStep(p, now)
  if (got !== want) throw new Error(`nextStep(${JSON.stringify(p)}) = ${got}, want ${want}`)
}

type J = Parameters<typeof dueItems>[0][number]
const job = (id: string, status: J['status'], appliedAt: string | null, nextAt: string | null = null): J => ({ id, status, appliedAt, nextAt })
const due = dueItems(
  [
    job('stale', 'applied', daysAgo(14)),
    job('fresh', 'applied', daysAgo(13)),
    job('followed', 'applied', daysAgo(30), daysAgo(0.5)),
    job('waiting', 'applied', daysAgo(30), daysAgo(-3)),
    job('nodate', 'interview', daysAgo(30)),
    job('interview', 'interview', daysAgo(30), daysAgo(-1)),
    job('farInterview', 'interview', daysAgo(30), daysAgo(-5)),
    job('pastInterview', 'interview', daysAgo(30), daysAgo(2)),
    job('deadline', 'saved', null, daysAgo(-2)),
    job('farDeadline', 'evaluated', null, daysAgo(-10)),
    job('offer', 'offer', daysAgo(40), daysAgo(-3)),
    job('closed', 'rejected', daysAgo(40), daysAgo(-1)),
    job('never', 'applied', null),
  ],
  cases.map(([p]) => p),
  now,
)
const got = due.map((d) => (d.kind === 'job' ? `${d.job.id}:${d.label}:${d.href}` : `person:${d.label}`))
// Soonest first: overdue by a day, by half a day, then due right now (people before jobs on a tie).
const want = [
  'person:no reply',
  `followed:${SILENT_AFTER_FOLLOW_UP}:/jobs/followed`,
  'person:follow up',
  `stale:${STALE_APPLICATION}:/jobs/stale/apply`,
  'interview:Interview: rehearse:/jobs/interview/prepare',
  'deadline:Deadline: evaluate and apply:/jobs/deadline',
  'offer:Reply to the offer:/jobs/offer/offer',
]
if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`dueItems =\n${got.join('\n')}\nwant\n${want.join('\n')}`)
if (dueItems([], [], now).length !== 0) throw new Error('dueItems of nothing should be empty')
console.log('followup ok')
