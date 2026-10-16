// Run: npx tsx shared/test-reports.check.ts
import { providerName } from './assessment-catalog.ts'
import { askWhichTest, contradictions, testCountLine, testCounts, testReportError, type TestReportRow } from './test-reports.ts'

const ok = (cond: unknown, what: string, got?: unknown) => {
  if (!cond) throw new Error(`${what}${got === undefined ? '' : `: got ${JSON.stringify(got)}`}`)
}
const asOf = new Date('2026-10-16T12:00:00Z')
const ago = (days: number) => new Date(+asOf - days * 86_400_000)
const row = (userId: string, detail: string | null, days = 10, share: boolean | null = null): TestReportRow => ({ userId: `user-${userId}`, detail, createdAt: ago(days), share })

// Counts per company within 12 months: distinct students, opted-out and "Not sure" rows left out.
const rows = [row('a', 'shl'), row('b', 'shl', 200), row('a', 'shl', 30), row('c', 'shl', 400), row('d', 'shl', 5, false), row('e', null), row('f', 'aon', 1, true)]
const counts = testCounts(rows, asOf)
ok(counts.length === 1 && counts[0]!.provider === 'shl' && counts[0]!.students === 2, 'SHL: a and b, once each; c is 13 months old; d opted out; Aon has one student, so it does not show', counts)
ok(!testCounts([row('a', 'shl'), row('a', 'shl', 40)], asOf).length, 'one student reporting twice is still one: not shown')
ok(!testCounts([row('a', 'shl', -1)], asOf).length, 'a report after asOf is ignored')

// The display rule: counts, never names.
ok(testCountLine(counts[0]!) === 'SHL · reported by 2 students this year', '2+ students', testCountLine(counts[0]!))
ok(testCountLine({ provider: 'aon', students: 3 }) === `${providerName('aon')} · reported by 3 students this year`, 'publisher name, then the count')
ok(!counts.map(testCountLine).join(' ').includes('user-'), 'no user ids in the lines')

// A contradiction flags and doesn't replace: the intel's provider is an input, never an output.
const intel = { provider: 'shl', sourceDate: ago(60).toISOString() }
const after = [row('g', 'aon', 10), row('h', 'aon', 20), row('h', 'aon', 25), row('i', 'aon', 90), row('j', 'shl', 10), row('k', 'aon', 10, false)]
ok(contradictions(after, intel.provider, intel.sourceDate, asOf) === 2, 'g and h since the intel was checked; i is older; j agrees; k opted out')
ok(contradictions([row('g', 'aon', 10), row('h', 'sova', 10)], intel.provider, intel.sourceDate, asOf) === 0, 'one student per other publisher: no warning')
ok(contradictions([row('g', 'aon', 10), row('h', 'aon', 10, false)], intel.provider, intel.sourceDate, asOf) === 0, 'a single report after the opt-out: no warning')
ok(intel.provider === 'shl', 'the intel is unchanged')
ok(contradictions(after, null, intel.sourceDate, asOf) === 0 && contradictions(after, 'Some vendor', intel.sourceDate, asOf) === 0, 'no known intel provider, nothing to contradict')

// Asked once per job: only at assessment, and an answer, "Not sure" or a dismissal (all stored) ends it.
ok(askWhichTest('assessment', false) && !askWhichTest('assessment', true) && !askWhichTest('applied', false), 'ask once, at assessment')

// Ownership, one answer per job, and only a listed publisher.
const mine = { userId: 'user-a' }
ok(testReportError(mine, 'user-a', false, 'shl') === null && testReportError(mine, 'user-a', false, null) === null, 'own job, a publisher or Not sure')
ok(testReportError(mine, 'user-b', false, 'shl') === 'Posting not found' && testReportError(null, 'user-a', false, 'shl') === 'Posting not found', "someone else's job is not found")
ok(testReportError(mine, 'user-a', true, 'shl') === 'Already answered for this job', 'dismissed or answered: no second answer')
ok(testReportError(mine, 'user-a', false, 'Ada Lovelace') === 'Unknown test publisher', 'free text is refused')
console.log('test reports ok')
