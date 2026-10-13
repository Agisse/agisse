import { useRef } from 'react'
import type { GameProps } from '../engine/types'

/** Round counting for round-limited simulations, and a game's own end rule (simulation only; practice keeps going). */
export function useRounds({ rounds, onDone, mode }: Pick<GameProps, 'rounds' | 'onDone' | 'mode'>) {
  const played = useRef(0)
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone?.()
  }
  return {
    /** Counts one answered round; true once `rounds` are played (onDone has been called). */
    count: () => {
      played.current++
      if (rounds !== undefined && played.current >= rounds) finish()
      return done.current
    },
    /** The game's own stop rule fired (e.g. three misses in a row). */
    endRule: () => {
      if (rounds !== undefined || mode === 'simulation') finish()
    },
    done: () => done.current,
  }
}
