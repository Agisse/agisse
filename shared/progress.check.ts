// Run: npx tsx shared/progress.check.ts
import { answerStats, nextSteps, persistentCvFails, recurringGaps, starScore } from './progress.ts'
import type { PracticeAnswer } from './interview.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const ans = (day: number, gaps: string[], star = [true, true, true, false], delivery: PracticeAnswer['delivery'] = null): PracticeAnswer => ({
  id: String(day),
  question: 'q',
  answer: 'a',
  feedback: { star: { situation: star[0]!, task: star[1]!, action: star[2]!, result: star[3]! }, strengths: [], gaps, tighter: 't' },
  source: delivery ? 'mock' : 'text',
  delivery,
  createdAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`,
})

eq(starScore(ans(1, [])), 75, 'star score')
const answers = [
  ans(1, ['Add the measurable outcome of the project', 'Be more specific about the example']),
  ans(2, ['State the result in numbers']),
  ans(3, ['Say what you personally did', 'Quantify the impact']),
  ans(4, ['Explain why this company'], [true, true, true, true], { durationSec: 120, words: 260, wpm: 130, fillers: 4, retakes: 0, startDelaySec: 2 }),
]
eq(recurringGaps(answers), [{ theme: 'No measurable result', count: 3 }], 'one gap per answer per theme, needs 2+')
const st = answerStats(answers)
eq([st.count, st.star, st.wpm, st.fillersPerMin, st.trend], [4, 81, 130, 2, [75, 75, 75, 100]], 'answer stats')

const log = [
  { score: 70, failed: ['quantified', 'dates'], at: '2026-10-01' },
  { score: 78, failed: ['quantified', 'buzzwords'], at: '2026-10-03' },
]
eq(persistentCvFails(log), ['quantified'], 'failed in both last runs')
eq(persistentCvFails(log.slice(0, 1)), [], 'needs two runs')

const steps = nextSteps({ weakSkill: { label: 'Working memory', value: 30, href: '/practice' }, answers, cvLog: log, lastJobId: 'j1' })
eq(
  steps.map((s) => s.area),
  ['games', 'answers', 'cv'],
  'weakest first',
)
eq(steps[1]!.href, '/jobs/j1/prepare', 'answers link to the last posting')
eq(nextSteps({ weakSkill: null, answers: [], cvLog: [], lastJobId: null }).map((s) => s.area), ['cv', 'answers'], 'baselines when empty')
console.log('progress ok')
