import type { ComponentType } from 'react'
import type { CognitiveSkill, GameId, GameResult, TrainingMode } from '../../../../shared/assessments'

/** One answered item. Games call onTrial once per item; the session adapts difficulty from these. */
export type Trial = {
  correct: boolean
  /** ms from the stimulus appearing to the answer; for a correctly withheld response, the full window. */
  rt: number
  /** A correctly withheld response (no-go, a lure): its rt is the window, not a reaction, so speed measures skip it. */
  withheld?: boolean
  /** The level the item was generated at. */
  level: number
  /** Optional tag a game uses for its own metrics: 'switch' | 'repeat', 'go' | 'nogo', 'safe' | 'risky', … */
  kind?: string
}

export type GameProps = {
  /** Current difficulty, 1 (easiest) … 10. Read it when generating the next item; it can change between items. */
  level: number
  mode: TrainingMode
  /** Practice mode: show right/wrong and a one-line explanation after each item. Otherwise show nothing until the end. */
  feedback: boolean
  onTrial: (t: Trial) => void
  /** Rule variant when one component serves several provider games (ProviderGame.variant); undefined = the default rules. */
  variant?: string
  /** Simulation of a round-limited provider game: play exactly this many rounds, then call onDone. Undefined = run until the clock ends. */
  rounds?: number
  /** Ends the game early (all rounds played, or the game's own end condition, e.g. three misses in a row). */
  onDone?: () => void
  /** The runner has paused the clock and covers the board. Games with their own timers (flashes, countdowns) should hold them while true. */
  paused?: boolean
}

/** A drill or a practice version of a provider's game (see shared/assessment-catalog.ts for which). */
export type GameDef = {
  id: GameId
  name: string
  skills: CognitiveSkill[]
  /** One sentence shown before starting. */
  howTo: string
  /** Default session length in seconds. */
  duration: number
  /** Median response time (ms) a fluent answer takes at mid difficulty; the adaptive rule compares against it. */
  targetRt: number
  Component: ComponentType<GameProps>
  /** Game-specific raw measures (switch cost, false positives, …) folded into GameResult.details. */
  details?: (trials: Trial[]) => Record<string, number>
}

export type { GameResult }
