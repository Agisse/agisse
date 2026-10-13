// Run: npx tsx shared/patterns.check.ts
import { patterns, sourceOf, type PatternJob } from './patterns.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString()
const job = (score: number | null, url: string | null, steps: Array<[PatternJob['status'], number]>): PatternJob => ({
  url,
  score,
  status: steps[steps.length - 1][0],
  appliedAt: steps.find(([s]) => s === 'applied') ? day(steps.find(([s]) => s === 'applied')![1]) : null,
  history: steps.map(([status, n]) => ({ status, at: day(n) })),
})

const jobs: PatternJob[] = [
  job(4.6, 'https://boards.greenhouse.io/a/jobs/1', [['saved', 0], ['applied', 1], ['interview', 8]]),
  job(4.2, 'https://jobs.lever.co/b/x', [['applied', 0], ['responded', 4], ['offer', 20]]),
  job(4.1, 'https://jobs.lever.co/c/y', [['applied', 0], ['rejected', 2]]),
  job(3.2, 'https://www.linkedin.com/jobs/view/1/', [['applied', 0]]),
  job(3.5, null, [['applied', 0]]),
  job(3.8, 'https://careers.acme.com/job/9', [['applied', 0]]),
  job(4.8, 'https://jobs.ashbyhq.com/d/z', [['saved', 0]]), // never applied: not counted
]
const p = patterns(jobs)
eq(p.applied, 6, 'applied count')
eq(p.byScore.map((r) => [r.key, r.applied, r.replied]), [['4.5 and up', 1, 1], ['4.0–4.4', 2, 2], ['Below 4.0', 3, 0]], 'score bands')
eq(p.bySource[0], { key: 'Lever', applied: 2, replied: 2, interviews: 1, offers: 1 }, 'top source')
eq(p.medianReplyDays, 4, 'median days to reply (2, 4, 7)')
eq(p.lowScoreGap?.startsWith('Postings scored 4.0 or more got a reply 100%'), true, 'low score gap')
eq([sourceOf(null), sourceOf('https://acme.wd3.myworkdayjobs.com/x'), sourceOf('nonsense')], ['Pasted', 'Workday', 'Pasted'], 'sources')
console.log('patterns ok')
