// What to practise for one application: skills weighted by what the process likely tests, and short drills on the weakest.
import { COGNITIVE_SKILLS, DRILL_IDS, SKILL_GAMES, providerProfile, type AssessmentType, type CognitiveSkill, type CompanyAssessment, type GameId, type SkillWeight, type TrainingSession } from '../../../../shared/assessments'
import { currentLevel } from '../analytics/skills'

export type Allocation = { skill: CognitiveSkill; weight: number; games: GameId[] }
export type TrainingPlan = {
  allocation: Allocation[]
  estimated: boolean
  source: 'company' | 'provider' | 'none'
  practiceOrder: GameId[]
  prepMinutes: number
  hasGames: boolean
}
export type DrillStep = { gameId: GameId; seconds: number }

const NUMERIC: CognitiveSkill[] = ['numerical-speed', 'numerical-accuracy', 'estimation']
/** Which skills each assessment type makes worth drilling. Personality, video and coding have nothing here to train. */
const TRAINS: Partial<Record<AssessmentType, readonly CognitiveSkill[]>> = {
  'game-based': COGNITIVE_SKILLS,
  numerical: NUMERIC,
  'mental arithmetic': NUMERIC,
  logical: ['logical-reasoning'],
  verbal: ['verbal-reasoning'],
  'situational judgement': ['situational-judgement'],
}
/** The skill's generic drills, else its first game (skills only provider games train, e.g. planning). */
const drillsFor = (skill: CognitiveSkill) => {
  const drills = SKILL_GAMES[skill].filter((g) => DRILL_IDS.includes(g))
  return drills.length ? drills : SKILL_GAMES[skill].slice(0, 1)
}

/** Rough prep per drill: one untimed practice round plus one timed run. */
const MINUTES_PER_GAME = 10

export function trainingPlan(a: CompanyAssessment | null): TrainingPlan {
  const none: TrainingPlan = { allocation: [], estimated: false, source: 'none', practiceOrder: [], prepMinutes: 0, hasGames: false }
  if (!a) return none
  const profile = providerProfile(a.provider)

  let weights: SkillWeight[] = []
  let source: TrainingPlan['source'] = 'none'
  let estimated = true
  if (a.skills.length) {
    weights = a.skills
    source = 'company'
    estimated = a.weightsEstimated
  } else if (a.gameTypes.length) {
    // Only the drills are known: every skill they train, weighted evenly.
    const skills = COGNITIVE_SKILLS.filter((s) => SKILL_GAMES[s].some((g) => a.gameTypes.includes(g)))
    weights = skills.map((skill) => ({ skill, weight: 1 / skills.length }))
    source = 'company'
  } else if (profile) {
    weights = profile.skills
    source = 'provider'
  }

  const types = a.assessmentTypes.length ? a.assessmentTypes : (profile?.assessmentTypes ?? [])
  const allowed = new Set<CognitiveSkill>(types.length ? types.flatMap((t) => TRAINS[t] ?? []) : COGNITIVE_SKILLS)
  const kept = weights.filter((w) => allowed.has(w.skill) && w.weight > 0)
  if (!kept.length) return { ...none, source, estimated }

  const total = kept.reduce((s, w) => s + w.weight, 0)
  const allocation = kept
    .map((w) => {
      const preferred = SKILL_GAMES[w.skill].filter((g) => a.gameTypes.includes(g))
      // No named game: the skill's generic drills, else whatever trains it (skills only provider games train).
      return { skill: w.skill, weight: w.weight / total, games: preferred.length ? preferred : drillsFor(w.skill) }
    })
    .sort((x, y) => y.weight - x.weight)
  const practiceOrder = [...new Set(allocation.flatMap((x) => x.games))]
  return { allocation, estimated, source, practiceOrder, prepMinutes: practiceOrder.length * MINUTES_PER_GAME, hasGames: true }
}

/** Seconds per drill so a daily drill lands at about 7 minutes. */
export const drillSeconds = (n: number) => Math.max(150, Math.round(420 / Math.max(1, n)))

/**
 * Up to three drills on the weakest skills: untrained first, then lowest recent score. Restricted to the allocation when given
 * (an empty allocation means nothing relevant to drill).
 */
export function drillPlan(sessions: TrainingSession[], allocation?: Allocation[]): DrillStep[] {
  const pool = allocation ?? COGNITIVE_SKILLS.map((skill) => ({ skill, weight: 0, games: drillsFor(skill) }))
  const ranked = pool
    .map((a, i) => ({ ...a, i, level: currentLevel(sessions, a.skill) ?? -1 }))
    .sort((x, y) => x.level - y.level || y.weight - x.weight || x.i - y.i)
  const games: GameId[] = []
  for (const r of ranked) {
    const g = r.games.find((x) => !games.includes(x))
    if (g) games.push(g)
    if (games.length === 3) break
  }
  const seconds = drillSeconds(games.length)
  return games.map((gameId) => ({ gameId, seconds }))
}
