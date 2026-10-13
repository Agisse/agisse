// Personal progress per skill, from the user's own sessions only.
import { BENCHMARK_MIN_USERS, type CognitiveSkill, type SkillBenchmark, type TrainingSession } from '../../../../shared/assessments'

const byTime = (a: TrainingSession, b: TrainingSession) => a.createdAt.localeCompare(b.createdAt)
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

/** The skill's score per session, oldest first. */
function values(sessions: TrainingSession[], skill: CognitiveSkill) {
  return [...sessions]
    .sort(byTime)
    .flatMap((s) => {
      const v = s.result.skillMetrics[skill]
      return typeof v === 'number' ? [{ day: s.createdAt.slice(0, 10), value: v }] : []
    })
}

/** Per-day average, oldest first. */
export function skillSeries(sessions: TrainingSession[], skill: CognitiveSkill): { day: string; value: number }[] {
  const days = new Map<string, number[]>()
  for (const v of values(sessions, skill)) days.set(v.day, [...(days.get(v.day) ?? []), v.value])
  return [...days].map(([day, vs]) => ({ day, value: Math.round(avg(vs)) }))
}

/** Average of the last three sessions that trained the skill; null when never trained. */
export function currentLevel(sessions: TrainingSession[], skill: CognitiveSkill): number | null {
  const vs = values(sessions, skill).slice(-3)
  return vs.length ? Math.round(avg(vs.map((v) => v.value))) : null
}

export type SkillProgress = { skill: CognitiveSkill; current: number | null; trend: number[]; percentile: number | null }

export function skillProgress(sessions: TrainingSession[], skills: CognitiveSkill[], benchmarks: SkillBenchmark[] = []): SkillProgress[] {
  return skills.map((skill) => {
    const b = benchmarks.find((x) => x.skill === skill)
    return {
      skill,
      current: currentLevel(sessions, skill),
      trend: skillSeries(sessions, skill)
        .slice(-5)
        .map((p) => p.value),
      // Only a real percentile from enough real users; never estimated here.
      percentile: b && b.percentile !== null && b.users >= BENCHMARK_MIN_USERS ? b.percentile : null,
    }
  })
}
