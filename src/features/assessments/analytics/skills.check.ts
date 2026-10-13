// Run: npx tsx src/features/assessments/analytics/skills.check.ts
import type { TrainingSession } from '../../../../shared/assessments'
import { currentLevel, skillProgress, skillSeries } from './skills'

const ok = (c: unknown, m = 'check failed') => {
  if (!c) throw new Error(m)
}
const eq = (got: unknown, want: unknown, m = '') => ok(JSON.stringify(got) === JSON.stringify(want), `${m} got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

const s = (v: number, at: string): TrainingSession => ({
  id: at, jobId: null, mode: 'practice', gameId: 'working-memory', providerGameId: null, durationSec: 60, createdAt: at,
  result: { score: v, accuracy: 1, medianResponseTime: 500, difficultyReached: 3, errors: 0, trials: 10, skillMetrics: { 'working-memory': v }, details: {} },
})
const sessions = [s(80, '2026-09-03T09:00:00Z'), s(60, '2026-09-01T09:00:00Z'), s(64, '2026-09-01T18:00:00Z'), s(70, '2026-09-02T09:00:00Z')]

eq(skillSeries(sessions, 'working-memory'), [{ day: '2026-09-01', value: 62 }, { day: '2026-09-02', value: 70 }, { day: '2026-09-03', value: 80 }])
eq(currentLevel(sessions, 'working-memory'), 71, 'last three sessions: 64, 70, 80')
eq(currentLevel(sessions, 'attention'), null)
const [wm, att] = skillProgress(sessions, ['working-memory', 'attention'], [
  { skill: 'working-memory', users: 12, percentile: 80 },
  { skill: 'attention', users: 50, percentile: null },
])
eq(wm!.trend, [62, 70, 80])
eq(wm!.percentile, null, 'too few users: no percentile')
eq(att!.percentile, null, 'null percentile stays null')
eq(skillProgress(sessions, ['working-memory'], [{ skill: 'working-memory', users: 40, percentile: 72 }])[0]!.percentile, 72)
console.log('skills ok')
