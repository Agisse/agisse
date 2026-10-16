// Run: npx tsx src/features/assessments/components/next.check.ts
import { nextPractice, type KnownTests, type UpcomingJob } from './next.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const now = new Date('2026-10-16T09:00:00').getTime()
const day = (n: number) => new Date(now + n * 86_400_000).toISOString()
const job = (id: string, company: string, status: UpcomingJob['status'], nextAt: string | null = null): UpcomingJob => ({ id, company, role: 'Graduate', status, nextAt })
const tests = (c: string): KnownTests | null => (c === 'Deloitte' ? { publisher: 'HireVue', games: ['a', 'b'], minutes: 20 } : null)
const weak = { area: 'games' as const, text: 'Drill working memory: your weakest skill at 30/100.', href: '/practice?mode=drill&games=nback' }

// The soonest live stage wins, whatever the list order.
const both = [job('d', 'Deloitte', 'assessment', day(5)), job('b', 'BCG', 'interview', day(2))]
eq(nextPractice(both, tests, weak, now).href, '/prepare/interviews?job=b', 'soonest first: interview')
eq(nextPractice(both, tests, weak, now).detail, 'In 2 days. Questions for Graduate.', 'interview detail')
const d = nextPractice([both[0]!], tests, weak, now)
eq([d.title, d.detail, d.href], ["Practise Deloitte's tests", 'Test due in 5 days. They use HireVue. About 20 min.', '/jobs/d/practice?mode=practice&games=a%2Cb'], 'known tests')
// A test stage with no known publisher still gets a concrete practice: the drill.
eq(nextPractice([job('x', 'Acme', 'assessment', day(1))], tests, weak, now).href, '/practice?mode=drill', 'unknown test → drill')
eq(nextPractice([job('x', 'Acme', 'assessment', day(1))], tests, weak, now).detail.startsWith('Test due tomorrow.'), true, 'tomorrow')
// Dated jobs come before undated ones.
eq(nextPractice([job('x', 'Acme', 'interview'), job('b', 'BCG', 'interview', day(0))], tests, weak, now).detail, 'Today. Questions for Graduate.', 'dated first')
// An earlier application with a known test set, then the weakest area, then the drill.
eq(nextPractice([job('d', 'Deloitte', 'applied'), job('r', 'Deloitte', 'rejected')], tests, weak, now).title, "Get ahead on Deloitte's tests", 'early stage')
eq(nextPractice([job('r', 'Deloitte', 'rejected')], tests, weak, now).href, weak.href, 'weakest skill')
eq(nextPractice([], tests, { area: 'cv', text: 'Run a CV review.', href: '/prepare/cv' }, now).action, 'Review my CV', 'cv step')
eq(nextPractice([], tests, { area: 'answers', text: 'Answer one.', href: '/jobs' }, now).href, '/prepare/interviews', 'answers go to interviews')
eq(nextPractice([], tests, null, now).title, 'Daily drill', 'fallback')
console.log('next.check ok')
