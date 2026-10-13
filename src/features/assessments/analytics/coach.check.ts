// Run: npx tsx src/features/assessments/analytics/coach.check.ts
import type { GameResult } from '../../../../shared/assessments'
import { coachNotes } from './coach'

const ok = (c: unknown, m = 'check failed') => {
  if (!c) throw new Error(m)
}
const eq = (got: unknown, want: unknown, m = '') => ok(JSON.stringify(got) === JSON.stringify(want), `${m} got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

const r = (over: Partial<GameResult> = {}): GameResult => ({ score: 70, accuracy: 0.82, medianResponseTime: 600, difficultyReached: 6, errors: 7, trials: 40, skillMetrics: {}, details: {}, ...over })

const risk = coachNotes(r({ details: { lowVarianceRate: 0.78, evRate: 0.6 } }), 'risk-reward')
eq(risk[0], 'Accuracy was 82% over 40 items, reaching level 6 of 10.')
eq(risk[1], 'In this session, you picked the lower-variance option in 78% of choices and the higher expected-value option in 60%.')
ok(risk.length <= 3)

const faster = coachNotes(r({ details: { switchCostMs: 212.4, switchAccuracy: 0.8, repeatAccuracy: 0.95 } }), 'task-switching', [r({ medianResponseTime: 700 }), r({ medianResponseTime: 800 })])
eq(faster[1], 'Changing rules added about 212 ms per answer, and accuracy was 80% on switches and 95% on repeats.')
ok(/faster than your earlier sessions \(750 ms\)/.test(faster[2]!))

eq(coachNotes(r({ details: { falsePositives: 1, misses: 3, meanGoRt: 410 } }), 'go-no-go')[1], 'You responded to 1 no-go item and missed 3 go items; your average go response was 410 ms.')
eq(coachNotes(r({ details: { hits: 9, falseAlarms: 2 } }), 'n-back')[1], 'You caught 9 matches with 2 false alarms.')
eq(coachNotes(r({ details: { meanHitRate: 71 } }), 'attention-tracking')[1], 'You tracked 71% of targets on average.')
eq(coachNotes(r(), 'numerical-speed').length, 2, 'no detail keys: accuracy and speed only')
eq(coachNotes(r({ trials: 0 }), 'estimation'), ['No answers were recorded in this session.'])

const banned = /you are|risk-averse|personality|employer|trait/i
for (const n of [...risk, ...faster]) ok(!banned.test(n), n)
console.log('coach ok')
