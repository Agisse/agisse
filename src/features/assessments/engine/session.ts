// The common game loop: collects trials, adapts difficulty, turns trials into a GameResult.
import type { GameResult } from '../../../../shared/assessments'
import type { GameDef, Trial } from './types'

export const MIN_LEVEL = 1
export const MAX_LEVEL = 10
/** Trials the adaptive rule looks back over, and the least number of trials between two level changes. */
const WINDOW = 6
/** Response times that measure a reaction: a correctly withheld response only waited out its window. */
const reactionRts = (ts: Trial[]) => ts.filter((t) => !t.withheld).map((t) => t.rt)

export const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/**
 * Up when recent accuracy > 85% at or under the target time, down when it drops below 60%. One step at a time,
 * never past the bounds: harder means more items, faster pacing or subtler differences, never impossible ones.
 */
export function nextLevel(level: number, recent: Trial[], targetRt: number): number {
  if (recent.length < WINDOW) return level
  const acc = recent.filter((t) => t.correct).length / recent.length
  // 5 of 6 counts: with a 6-trial window a strict > 85% would demand a perfect run.
  if (acc >= 5 / 6 && median(reactionRts(recent)) <= targetRt) return Math.min(MAX_LEVEL, level + 1)
  if (acc < 0.6) return Math.max(MIN_LEVEL, level - 1)
  return level
}

/** 0–100, Agisse-internal: accuracy first, then how hard it got, then speed. */
export function scoreOf(accuracy: number, levelReached: number, medianRt: number, targetRt: number) {
  const speed = medianRt > 0 ? Math.min(1, targetRt / medianRt) : 0
  return Math.round(100 * (0.6 * accuracy + 0.25 * (levelReached / MAX_LEVEL) + 0.15 * speed))
}

/**
 * The spec's AssessmentGame: start → submitAnswer per item → finish. The React runner owns one per game played.
 * Simulation mode keeps the level fixed per item (mixed difficulty) instead of adapting.
 */
export class GameSession {
  readonly game: GameDef
  level: number
  trials: Trial[] = []
  startedAt = 0
  private sinceChange = 0
  private adaptive: boolean

  private scored: boolean

  constructor(game: GameDef, startLevel = 3, adaptive = true, scored = true) {
    this.game = game
    this.scored = scored
    this.level = startLevel
    this.adaptive = adaptive
  }

  get id() {
    return this.game.id
  }
  get name() {
    return this.game.name
  }
  get skills() {
    return this.game.skills
  }
  get difficulty() {
    return this.level
  }
  get duration() {
    return this.game.duration
  }

  start() {
    this.startedAt = Date.now()
    this.trials = []
    this.sinceChange = 0
  }

  /** Records one answer and returns the level for the next item. */
  submitAnswer(t: Trial): number {
    this.trials.push(t)
    if (!this.adaptive) {
      // Mixed difficulty: wander around the starting band so the run has easy and hard items.
      this.level = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, this.level + (Math.random() < 0.5 ? -1 : 1)))
      return this.level
    }
    if (++this.sinceChange >= WINDOW) {
      const next = nextLevel(this.level, this.trials.slice(-WINDOW), this.game.targetRt)
      if (next !== this.level) {
        this.level = next
        this.sinceChange = 0
      }
    }
    return this.level
  }

  finish(): GameResult {
    const n = this.trials.length
    const correct = this.trials.filter((t) => t.correct).length
    const accuracy = n ? correct / n : 0
    const hits = this.trials.filter((t) => t.correct)
    const medianResponseTime = Math.round(median(reactionRts(hits)))
    // Adaptive: the hardest level answered right. Fixed-level walk (simulation): the level reached is chance, so the mean level answered right.
    const difficultyReached = !hits.length ? MIN_LEVEL : this.adaptive ? Math.max(...hits.map((t) => t.level)) : Math.round(hits.reduce((s, t) => s + t.level, 0) / hits.length)
    // A run of only withheld responses has no reaction time; it is not slow.
    const speedRt = medianResponseTime || (hits.length ? this.game.targetRt : 0)
    const score = n ? scoreOf(accuracy, difficultyReached, speedRt, this.game.targetRt) : 0
    return {
      score,
      accuracy: Math.round(accuracy * 1000) / 1000,
      medianResponseTime,
      difficultyReached,
      errors: n - correct,
      trials: n,
      // No trials, or a preference game with no right answer (scored: false): nothing to say about a skill.
      skillMetrics: n && this.scored ? Object.fromEntries(this.game.skills.map((s) => [s, score])) : {},
      details: this.game.details?.(this.trials) ?? {},
    }
  }
}
