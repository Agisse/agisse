import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './pymetrics.css'

type Rand = () => number
export const GO_MS = 15000
/** Window after STOP in which presses still count, as late presses. */
export const AFTER_MS = 2000
/** Random wait before GO so it can't be timed. */
export const readyMs = (rand: Rand = Math.random) => 1500 + Math.round(rand() * 2000)

// ponytail: no difficulty axis; every round is the same 15 s, as in the real game.
/** correct = no press before GO. rt = mean ms between presses. kind = 'keys:<presses>:<early>:<late>'. */
export function keyTrial(presses: number, early: number, late: number, level: number): Trial {
  return { correct: early === 0, rt: presses ? Math.round(GO_MS / presses) : GO_MS, level, kind: `keys:${presses}:${early}:${late}` }
}

export function keypressesDetails(trials: Trial[]) {
  const rs = trials.map((t) => t.kind?.match(/^keys:(\d+):(\d+):(\d+)$/)).filter((m) => m !== null && m !== undefined)
  const sum = (i: number) => rs.reduce((s, m) => s + Number(m[i]), 0)
  return {
    pressesPerSecond: rs.length ? Math.round((sum(1) / (rs.length * (GO_MS / 1000))) * 100) / 100 : 0,
    earlyPresses: sum(2),
    latePresses: sum(3),
  }
}

type Phase = 'ready' | 'go' | 'stop' | 'rest'

function KeypressesGame({ level, onTrial, rounds, onDone }: GameProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [presses, setPresses] = useState(0)
  const [last, setLast] = useState<string | null>(null)
  const early = useRef(0)
  const late = useRef(0)
  const played = useRef(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    const next: Record<Phase, [Phase, number]> = { ready: ['go', readyMs()], go: ['stop', GO_MS], stop: ['rest', AFTER_MS], rest: ['ready', 2500] }
    const [to, ms] = next[phase]
    const t = setTimeout(() => {
      if (to === 'rest') {
        onTrial(keyTrial(presses, early.current, late.current, level))
        setLast(`${presses} presses (${(presses / (GO_MS / 1000)).toFixed(1)} a second)${early.current ? ` · ${early.current} before GO` : ''}${late.current ? ` · ${late.current} after STOP` : ''}`)
        if (rounds && ++played.current >= rounds) return doneRef.current?.()
      }
      if (to === 'ready') {
        setPresses(0)
        early.current = 0
        late.current = 0
      }
      setPhase(to)
    }, ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function press() {
    if (phase === 'ready') early.current++
    else if (phase === 'go') setPresses((n) => n + 1)
    else if (phase === 'stop') late.current++
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return
      e.preventDefault()
      press()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const label = { ready: 'Wait for GO', go: 'GO', stop: 'STOP', rest: 'Round over' }[phase]
  return (
    <div className="game">
      <div className="game__prompt">Press Space as fast as you can between GO and STOP. Don't start early.</div>
      <button
        type="button"
        className="pym-pad"
        data-phase={phase}
        onPointerDown={(e) => {
          e.preventDefault()
          press()
        }}
        onClick={(e) => {
          if (e.detail === 0) press() // Enter on the focused button; Space is handled globally
        }}
        // A held Enter repeats clicks; one press is one response.
        onKeyDown={(e) => e.key === 'Enter' && e.repeat && e.preventDefault()}
        aria-label="Press (Space)"
      >
        <span>{label}</span>
        {phase === 'go' && <span className="pym-pad__count">{presses}</span>}
      </button>
      {phase === 'go' && <div className="pym-timer" style={{ '--timer-ms': `${GO_MS}ms` } as CSSProperties} aria-hidden="true" />}
      <div className="game__feedback" aria-live="polite">
        {last}
      </div>
      <div className="game__keys">Space or tap the pad</div>
    </div>
  )
}

export const keypresses: GameDef = {
  id: 'keypresses',
  name: 'Keypresses',
  skills: ['reaction-time'],
  howTo: 'When GO shows, press Space as many times as you can until STOP. Presses before GO or after STOP are logged.',
  duration: 90,
  targetRt: 180,
  Component: KeypressesGame satisfies ComponentType<GameProps>,
  details: keypressesDetails,
}
