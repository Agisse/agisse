// Run: npx tsx shared/outcomes.check.ts
import { lastMonday, outcomeLine, outcomeStats, type OutcomeRow } from './outcomes.ts'
import type { JobStatus } from './types.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

// Friday 2026-10-16 → Monday 2026-10-12 00:00 UTC; a Monday is its own as-of.
const asOf = lastMonday(new Date('2026-10-16T15:00:00Z'))
eq(asOf.toISOString(), '2026-10-12T00:00:00.000Z', 'last Monday')
eq(lastMonday(new Date('2026-10-12T00:00:00Z')).toISOString(), '2026-10-12T00:00:00.000Z', 'Monday is its own as-of')
eq(lastMonday(new Date('2026-10-11T23:59:00Z')).toISOString(), '2026-10-05T00:00:00.000Z', 'Sunday goes back six days')

const day = (n: number) => new Date(asOf.getTime() - n * 86_400_000).toISOString()
/** Applied `ago` days before asOf, then each step `after` days after applying. */
const row = (userId: string, ago: number, steps: [JobStatus, number][] = [], extra: Partial<OutcomeRow> = {}): OutcomeRow => ({
  userId,
  appliedAt: day(ago),
  history: [{ status: 'applied', at: day(ago) }, ...steps.map(([status, after]) => ({ status, at: day(ago - after) }))],
  ...extra,
})
const users = (n: number, steps: [JobStatus, number][] = []) => Array.from({ length: n }, (_, i) => row(`u${i}`, 60, steps))

eq(outcomeStats(users(9, [['responded', 9]]), asOf), null, '9 users gives null')
const ten = outcomeStats(users(10, [['responded', 9]]), asOf)
eq([ten?.applied, ten?.test, ten?.replyDays, ten?.asOf], ['10+', 0, 9, asOf.toISOString()], '10 users gives figures')

// A user with two jobs at the employer counts once, by their latest application.
eq(outcomeStats([...users(9), row('u0', 30)], asOf), null, 'two jobs, one user')
const latest = outcomeStats([...users(10), row('u0', 30, [['assessment', 5]])], asOf)
eq(latest?.test, 10, 'the latest job counts')

// A move after asOf is ignored, and so is an application after it.
eq(outcomeStats(users(10, [['assessment', 61]]), asOf)?.test, 0, 'move after asOf ignored')
eq(outcomeStats([...users(9), row('late', -2)], asOf), null, 'applied after asOf ignored')

// The window: 13 months ago is out, 11 months ago is in.
eq(outcomeStats([...users(9), row('old', 396)], asOf), null, '13 months ago excluded')
eq(outcomeStats([...users(9), row('recent', 335)], asOf)?.applied, '10+', '11 months ago included')

// Opted out of counting: left out (the SQL where-clause drops them first; this is the same rule).
eq(outcomeStats([...users(9), row('out', 30, [], { share: false })], asOf), null, 'opted out excluded')
eq(outcomeStats([...users(9), row('none', 30, [], { share: null })], asOf)?.applied, '10+', 'no profile counts')

// Bands.
eq(outcomeStats(users(19), asOf)?.applied, '10+', '19 → 10+')
eq(outcomeStats(users(20), asOf)?.applied, '20+', '20 → 20+')
eq(outcomeStats(users(49), asOf)?.applied, '20+', '49 → 20+')
eq(outcomeStats(users(50), asOf)?.applied, '50+', '50 → 50+')

// Rates to the nearest 5%: 7 of 20 = 35%, 3 of 20 = 15%, 1 of 30 ≈ 3.3% → 5%, 1 of 60 ≈ 1.7% → 0%.
const mixed = [
  ...Array.from({ length: 3 }, (_, i) => row(`i${i}`, 60, [['assessment', 10], ['interview', 20]])),
  ...Array.from({ length: 4 }, (_, i) => row(`t${i}`, 60, [['assessment', 8], ['rejected', 30]])),
  ...Array.from({ length: 13 }, (_, i) => row(`s${i}`, 60)),
]
const m = outcomeStats(mixed, asOf)
eq([m?.applied, m?.test, m?.interview, m?.offer], ['20+', 35, 15, 0], 'rates rounded to 5%')
eq(outcomeStats([...users(29), row('o', 60, [['offer', 30]])], asOf)?.offer, 5, '1 of 30 rounds up to 5%')
eq(outcomeStats([...users(59), row('o', 60, [['offer', 30]])], asOf)?.offer, 0, '1 of 60 rounds down to 0%')

// First reply: median whole days, a rejection counts as a reply, null below 10 replies.
eq(m?.replyDays, null, '7 replies is too few for a median')
const replies = Array.from({ length: 10 }, (_, i) => row(`r${i}`, 60, [[i % 2 ? 'rejected' : 'responded', i + 1]]))
eq(outcomeStats(replies, asOf)?.replyDays, 6, 'median of 1..10 days = 5.5 → 6')
eq(outcomeStats([...replies, row('r10', 60, [['responded', 11]])], asOf)?.replyDays, 6, 'odd count takes the middle')

// The line.
const line = { applied: '20+', test: 35, interview: 15, offer: 0, replyDays: 9, asOf: '' } as const
eq(outcomeLine(line), 'From 20+ applicants in the past year: 35% got a test, 15% an interview · first reply in ~9 days', 'the line')
eq(outcomeLine({ ...line, offer: 5, replyDays: null }), 'From 20+ applicants in the past year: 35% got a test, 15% an interview, 5% an offer', 'offer shown, no reply')

console.log('outcomes ok')
