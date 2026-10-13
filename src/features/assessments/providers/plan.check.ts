// Run: npx tsx src/features/assessments/providers/plan.check.ts
import type { CompanyAssessment, TrainingSession } from '../../../../shared/assessments'
import { drillPlan, trainingPlan } from './plan'

const ok = (c: unknown, m = 'check failed') => {
  if (!c) throw new Error(m)
}
const eq = (got: unknown, want: unknown, m = '') => ok(JSON.stringify(got) === JSON.stringify(want), `${m} got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)

const base: CompanyAssessment = {
  id: 'a', company: 'Acme', rolePattern: null, location: null, provider: null, assessmentTypes: [], gameTypes: [], skills: [], weightsEstimated: false,
  stages: [], difficulty: null, timeLimits: null, scoringDimensions: [], sources: [], sourceDate: '2026-01-01', confidence: 'high', origin: 'research', notes: null,
}

eq(trainingPlan(null).source, 'none')
eq(trainingPlan(base).hasGames, false, 'nothing known, nothing shown')

const company = trainingPlan({ ...base, assessmentTypes: ['game-based'], skills: [{ skill: 'attention', weight: 0.2 }, { skill: 'working-memory', weight: 0.8 }], weightsEstimated: true })
eq(company.source, 'company')
eq(company.estimated, true)
eq(company.allocation.map((a) => a.skill), ['working-memory', 'attention'], 'sorted by weight')
eq(company.practiceOrder, ['working-memory', 'n-back', 'attention-tracking', 'go-no-go'])
eq(company.prepMinutes, 40)

const provider = trainingPlan({ ...base, provider: 'Arctic Shores' })
eq(provider.source, 'provider')
eq(provider.estimated, true)
eq(provider.allocation[0]!.skill, 'working-memory')
ok(Math.abs(provider.allocation.reduce((s, a) => s + a.weight, 0) - 1) < 1e-9)

// HireVue is mostly video; with the company saying video only, no games.
eq(trainingPlan({ ...base, provider: 'hirevue', assessmentTypes: ['video interview'] }).hasGames, false, 'video only: no drills')
// SHL numerical + personality keeps only the numerical skills.
const shl = trainingPlan({ ...base, provider: 'shl', assessmentTypes: ['numerical', 'personality'] })
eq(shl.allocation.map((a) => a.skill).sort(), ['numerical-accuracy', 'numerical-speed'])
ok(Math.abs(shl.allocation.reduce((s, a) => s + a.weight, 0) - 1) < 1e-9, 'renormalised')
// Game types alone derive the skills, and prefer the listed drill.
const fromGames = trainingPlan({ ...base, assessmentTypes: ['game-based'], gameTypes: ['n-back'] })
eq(fromGames.allocation.map((a) => [a.skill, a.games]), [['working-memory', ['n-back']]])

const s = (gameId: TrainingSession['gameId'], metrics: TrainingSession['result']['skillMetrics'], day: string): TrainingSession => ({
  id: day, jobId: null, mode: 'drill', gameId, providerGameId: null, durationSec: 60, createdAt: `${day}T10:00:00Z`,
  result: { score: 0, accuracy: 1, medianResponseTime: 500, difficultyReached: 3, errors: 0, trials: 10, skillMetrics: metrics, details: {} },
})
const sessions = [s('working-memory', { 'working-memory': 90 }, '2026-09-01'), s('attention-tracking', { attention: 40 }, '2026-09-02')]
const drill = drillPlan(sessions, company.allocation)
eq(drill.map((d) => d.gameId), ['attention-tracking', 'working-memory'], 'weakest first, within allocation')
ok(drill.reduce((t, d) => t + d.seconds, 0) >= 300 && drill.reduce((t, d) => t + d.seconds, 0) <= 600, '5–10 minutes')
const daily = drillPlan(sessions)
eq(daily.length, 3)
ok(!daily.some((d) => d.gameId === 'working-memory'), 'untrained skills come before trained ones')
eq(drillPlan(sessions, []), [], 'empty allocation: nothing to drill')
console.log('plan ok')
