// Run: npx tsx src/lib/today.check.ts
import { todayNext } from './today.ts'
import { dueItems } from './followup.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const now = new Date('2026-10-16T09:00:00').getTime()
const day = (n: number) => new Date(now + n * 86_400_000).toISOString()
type J = Parameters<typeof todayNext>[0]['jobs'][number]
const job = (id: string, company: string, status: J['status'], x: Partial<J> = {}): J => ({ id, company, role: 'Graduate', status, nextAt: null, appliedAt: null, score: null, recommendation: null, ...x })
const tests = (c: string) => (c === 'Deloitte' ? { publisher: 'HireVue', games: ['a'], minutes: 20 } : null)
const run = (jobs: J[], step?: Parameters<typeof todayNext>[0]['step']) => todayNext({ step, due: dueItems(jobs, [], now), jobs, testsFor: tests, now })

// A first-run step beats everything.
const step = { done: false, label: 'Upload your CV', detail: 'd', action: 'Upload CV', href: '/welcome' }
eq(run([job('s', 'Acme', 'saved', { nextAt: day(1) })], step).kind, 'step', 'step first')
// Then the soonest thing due, in plain words.
const stale = job('a', 'Lowlands', 'applied', { appliedAt: day(-17) })
eq([run([stale]).title, run([stale]).detail, run([stale]).overdue], ['Follow up with Lowlands', 'Graduate · no reply in 2 weeks', true], 'stale application')
eq(run([job('s', 'Acme', 'saved', { nextAt: day(2) })]).title, 'Apply to Acme', 'deadline')
eq(run([job('s', 'Acme', 'saved', { nextAt: day(2) })]).detail, 'Graduate · deadline in 2 days', 'deadline detail')
eq(run([job('i', 'BCG', 'interview', { nextAt: day(1) })]).action, 'Rehearse', 'interview')
// Nothing due: a test to practise for the seeker's own application.
eq(run([job('d', 'Deloitte', 'assessment', { nextAt: day(6) })]).title, "Practise Deloitte's tests", 'test in 6 days')
// Then the best-scored role to apply to.
const roles = [job('m', 'Meridian', 'evaluated', { score: 4.2, recommendation: 'apply' }), job('n', 'Northwind', 'saved', { score: 4.7, recommendation: 'apply_now' }), job('x', 'Low', 'evaluated', { score: 2, recommendation: 'do_not_apply' })]
eq([run(roles).title, run(roles).href], ['Apply to Northwind', '/jobs/n/apply'], 'best role')
// Nothing at all: a way in.
eq([run([]).kind, run([]).href], ['clear', '/jobs?view=feed'], 'empty')
console.log('today.check ok')
