import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { median } from '../engine/session'
import { useRounds } from './rounds'
import './core.css'
import './variants.css'

type Rand = () => number
export const NOGO_SHARE = 0.25

/** Response window: 1100ms at level 1 down to 500ms at level 10. */
export const windowMs = (level: number) => Math.round(1100 - ((Math.min(10, Math.max(1, level)) - 1) * 600) / 9)
/** Blank gap before the next circle, jittered so the rhythm can't be anticipated. */
export const isiMs = (rand: Rand = Math.random) => 600 + Math.round(rand() * 900)
export const makeStimulus = (rand: Rand = Math.random): 'go' | 'nogo' => (rand() < NOGO_SHARE ? 'nogo' : 'go')
/** Pressed on go, or held back on no-go. */
export const isCorrect = (kind: 'go' | 'nogo', pressed: boolean) => (kind === 'go') === pressed

/** Pulse (HireVue): share of objects that carry the red dot, i.e. press. */
export const PULSE_GO_SHARE = 0.3
/** Pulse pace: the window shortens 8% after a right answer and widens 15% after a wrong one, within 400–1400 ms. */
export const pulsePace = (ms: number, ok: boolean) => Math.round(ok ? Math.max(400, ms * 0.92) : Math.min(1400, ms * 1.15))
/** Stimulus for a variant: Pulse presses on the rarer red dot; Stop (pymetrics, press red / hold green) keeps the default 25% holds. */
export const variantStimulus = (variant: string | undefined, rand: Rand = Math.random): 'go' | 'nogo' =>
  variant === 'pulse' ? (rand() < PULSE_GO_SHARE ? 'go' : 'nogo') : makeStimulus(rand)

const TEXT = {
  default: { go: 'Green: press', nogo: 'Red: hold', wait: 'Wait for the circle', keys: 'Space or tap on green · do nothing on red (✕)' },
  stop: { go: 'Red: press', nogo: 'Green: hold', wait: 'Wait for the circle', keys: 'Space or tap on red · do nothing on green (✕)' },
  pulse: { go: 'Red dot: press', nogo: 'No dot: hold', wait: 'Wait for the next object', keys: 'Space or tap only when the object has a red dot · the pace adapts' },
}

export function goNoGoDetails(trials: Trial[]) {
  const goRts = trials.filter((t) => t.kind === 'go' && t.correct).map((t) => t.rt)
  return {
    falsePositives: trials.filter((t) => t.kind === 'nogo' && !t.correct).length,
    misses: trials.filter((t) => t.kind === 'go' && !t.correct).length,
    meanGoRt: goRts.length ? Math.round(goRts.reduce((a, b) => a + b, 0) / goRts.length) : 0,
    medianGoRt: Math.round(median(goRts)),
  }
}

type Phase = { name: 'wait'; ms: number } | { name: 'stim'; kind: 'go' | 'nogo' } | { name: 'pause'; ok: boolean; text: string; ms: number }

/**
 * Presses while no circle is showing (during the gap or feedback) are ignored: they are neither scored nor
 * penalised, so the only false positive is a press on a red circle.
 */
function GoNoGoGame({ level, feedback, onTrial, variant, ...props }: GameProps) {
  const rr = useRounds(props)
  const v = variant === 'pulse' || variant === 'stop' ? variant : 'default'
  const txt = TEXT[v]
  const pace = useRef(windowMs(level))
  const [phase, setPhase] = useState<Phase>({ name: 'wait', ms: 1000 })
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  function settle(pressed: boolean) {
    if (phase.name !== 'stim') return
    const win = v === 'pulse' ? pace.current : windowMs(itemLevel.current)
    const ok = isCorrect(phase.kind, pressed)
    onTrial({ correct: ok, rt: pressed ? performance.now() - shownAt.current : win, withheld: ok && !pressed, level: itemLevel.current, kind: phase.kind })
    if (rr.count()) return
    if (v === 'pulse') pace.current = pulsePace(pace.current, ok)
    const [go, nogo] = v === 'default' ? ['green', 'red'] : v === 'stop' ? ['red', 'green'] : ['a red dot', 'no dot']
    const text = phase.kind === 'go' ? (pressed ? `${go}: pressed` : `${go} means press, a little quicker`) : pressed ? `${nogo} means hold back` : `${nogo}: held back`
    const gap = v === 'pulse' ? Math.round(pace.current * (0.6 + Math.random() * 0.8)) : isiMs()
    setPhase(feedback ? { name: 'pause', ok, text, ms: 900 } : { name: 'wait', ms: gap })
  }

  useEffect(() => {
    if (phase.name === 'stim') {
      shownAt.current = performance.now()
      const t = setTimeout(() => settle(false), v === 'pulse' ? pace.current : windowMs(itemLevel.current))
      return () => clearTimeout(t)
    }
    const t = setTimeout(
      () => {
        if (phase.name === 'pause') return setPhase({ name: 'wait', ms: isiMs() })
        itemLevel.current = levelRef.current
        setPhase({ name: 'stim', kind: v === 'default' ? makeStimulus() : variantStimulus(v) })
      },
      phase.ms,
    )
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return
      e.preventDefault()
      settle(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div className="game__prompt">
        {phase.name === 'stim' ? txt[phase.kind] : txt.wait}
      </div>
      <button
        type="button"
        className="core-stage"
        onPointerDown={(e) => {
          e.preventDefault()
          settle(true)
        }}
        onClick={(e) => {
          if (e.detail === 0) settle(true) // Enter on the focused button; Space is handled globally
        }}
        aria-label="Press (Space)"
      >
        {phase.name === 'stim' &&
          (v === 'pulse' ? (
            <span className="var-pulse" aria-hidden="true">
              {phase.kind === 'go' && <span className="var-pulse__dot" />}
            </span>
          ) : (
            // Stop swaps the colours: red is go, green is hold.
            <span className={`core-dot core-dot--${v === 'stop' ? (phase.kind === 'go' ? 'nogo' : 'go') : phase.kind}`} aria-hidden="true">
              {phase.kind === 'nogo' ? '✕' : ''}
            </span>
          ))}
      </button>
      <div className={`game__feedback ${phase.name === 'pause' ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {phase.name === 'pause' && `${phase.ok ? 'Right' : 'Not quite'}: ${phase.text}`}
      </div>
      <div className="game__keys">{txt.keys}</div>
    </div>
  )
}

export const goNoGo: GameDef = {
  id: 'go-no-go',
  name: 'Go / hold',
  skills: ['reaction-time', 'inhibition', 'attention'],
  howTo: 'Press Space or tap as soon as a green circle appears; do nothing when the circle is red.',
  duration: 90,
  targetRt: 450,
  Component: GoNoGoGame satisfies ComponentType<GameProps>,
  details: goNoGoDetails,
}
