import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './arctic.css'

type Rand = () => number
/** Hits in a row that open one lock; a miss resets the count. */
export const HITS_TO_OPEN = 3
const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const mod360 = (x: number) => ((x % 360) + 360) % 360

/** Stage 1 spins at 90°/s with a ±15° window; stage 10 at 630°/s with ±1.5° (about 5 ms), near-impossible. */
export function dialSpec(stage: number) {
  const s = Math.min(10, Math.max(1, Math.round(stage)))
  return { speed: 90 + (s - 1) * 60, halfWindow: Math.max(1.5, 15 - (s - 1) * 1.5), dir: s % 2 ? 1 : -1 }
}
/** Pointer angle (clockwise from the top) after `ms` of spinning. */
export const angleAt = (start: number, speed: number, dir: number, ms: number) => mod360(start + (dir * speed * ms) / 1000)
/** Signed shortest distance in degrees from the pointer to a digit (digit d sits at d × 36°). */
export const dialError = (angle: number, digit: number) => mod360(angle - digit * 36 + 180) - 180
export const newTarget = (prev: number | null, rand: Rand = Math.random) => {
  for (;;) {
    const d = int(0, 9, rand)
    if (d !== prev) return d
  }
}

/** correct = stopped within the window; kind 'hit:<err°>' or 'miss:<err°>'. */
export function judgeDial(angle: number, digit: number, halfWindow: number) {
  const err = Math.abs(dialError(angle, digit))
  const correct = err <= halfWindow
  return { correct, error: err, kind: `${correct ? 'hit' : 'miss'}:${Math.round(err)}` }
}

export function dialDetails(trials: Trial[]) {
  const stops = trials.filter((t) => t.kind?.startsWith('hit:') || t.kind?.startsWith('miss:'))
  const errs = stops.map((t) => Number(t.kind!.split(':')[1]))
  return {
    hitRate: stops.length ? Math.round((stops.filter((t) => t.correct).length / stops.length) * 1000) / 1000 : 0,
    skips: trials.filter((t) => t.kind === 'skip').length,
    meanErrorDeg: errs.length ? Math.round((errs.reduce((a, b) => a + b, 0) / errs.length) * 10) / 10 : 0,
  }
}

type Attempt = { target: number; start: number; level: number; spec: ReturnType<typeof dialSpec> }

function SecurityDialGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [stage, setStage] = useState(1)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  // Simulation climbs the real 10 stages; practice follows the adaptive level.
  const fresh = (st: number, target: number): Attempt => {
    const lv = rounds ? st : levelRef.current
    return { target, start: Math.random() * 360, level: lv, spec: dialSpec(lv) }
  }
  const [att, setAtt] = useState<Attempt>(() => fresh(1, newTarget(null)))
  const [progress, setProgress] = useState(0)
  const [fb, setFb] = useState<{ ok: boolean; text: string; next: Attempt } | null>(null)
  const pointer = useRef<SVGGElement>(null)
  const shownAt = useRef(0)

  useEffect(() => {
    if (fb) return
    shownAt.current = performance.now()
    let raf = 0
    const tick = () => {
      const a = angleAt(att.start, att.spec.speed, att.spec.dir, performance.now() - shownAt.current)
      pointer.current?.setAttribute('transform', `rotate(${a} 100 100)`)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [att, fb])

  useEffect(() => {
    if (!fb) return
    const t = setTimeout(() => {
      setFb(null)
      setAtt(fb.next)
    }, feedback ? 1000 : 500)
    return () => clearTimeout(t)
  }, [fb, feedback])

  /** Counts the lock as done (opened or skipped) and returns the first attempt at the next one. */
  function advance() {
    const ns = stage + 1
    setStage(ns)
    setProgress(0)
    if (rounds && ns > rounds) onDone?.()
    return fresh(ns, newTarget(att.target))
  }

  function stop() {
    if (fb) return
    const now = performance.now()
    const angle = angleAt(att.start, att.spec.speed, att.spec.dir, now - shownAt.current)
    pointer.current?.setAttribute('transform', `rotate(${angle} 100 100)`)
    const { correct, error, kind } = judgeDial(angle, att.target, att.spec.halfWindow)
    onTrial({ correct, rt: now - shownAt.current, level: att.level, kind })
    const opened = correct && progress + 1 >= HITS_TO_OPEN
    if (!opened) setProgress(correct ? progress + 1 : 0)
    setFb({
      ok: correct,
      next: opened ? advance() : fresh(stage, att.target),
      text: opened ? 'Lock open' : correct ? `On target, ${Math.round(error)}° off` : `Missed by ${Math.round(error)}°: lock progress reset`,
    })
  }

  function skip() {
    if (fb) return
    onTrial({ correct: false, rt: performance.now() - shownAt.current, level: att.level, kind: 'skip' })
    setFb({ ok: false, next: advance(), text: 'Lock skipped' })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === ' ') {
        e.preventDefault()
        stop()
      } else if (e.key === 's' || e.key === 'S') skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const tAngle = att.target * 36
  const arc = (deg: number) => {
    const r = ((deg - 90) * Math.PI) / 180
    return `${100 + 88 * Math.cos(r)} ${100 + 88 * Math.sin(r)}`
  }
  const hw = att.spec.halfWindow
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Stop the pointer on <strong>{att.target}</strong> · lock {Math.min(stage, rounds ?? stage)}
        {rounds ? ` of ${rounds}` : ''}
      </div>
      <button
        type="button"
        className="arc-dial"
        onPointerDown={(e) => {
          e.preventDefault()
          stop()
        }}
        onClick={(e) => {
          if (e.detail === 0) stop() // Enter on the focused button; Space is handled globally
        }}
        // A held Enter repeats clicks; one press is one response.
        onKeyDown={(e) => e.key === 'Enter' && e.repeat && e.preventDefault()}
        aria-label={`Stop the dial on ${att.target} (Space)`}
      >
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="94" className="arc-dial__face" />
          <path d={`M ${arc(tAngle - hw)} A 88 88 0 0 1 ${arc(tAngle + hw)}`} className="arc-dial__window" />
          {Array.from({ length: 10 }, (_, d) => {
            const r = ((d * 36 - 90) * Math.PI) / 180
            return (
              <text key={d} x={100 + 70 * Math.cos(r)} y={100 + 70 * Math.sin(r)} className="arc-dial__digit" data-target={d === att.target}>
                {d}
              </text>
            )
          })}
          <g ref={pointer}>
            <line x1="100" y1="100" x2="100" y2="16" className="arc-dial__pointer" />
          </g>
          <circle cx="100" cy="100" r="6" className="arc-dial__hub" />
        </svg>
      </button>
      <div className="arc-locks" aria-label={`Lock progress ${progress} of ${HITS_TO_OPEN}`}>
        {Array.from({ length: HITS_TO_OPEN }, (_, i) => (
          <span key={i} data-on={i < progress} />
        ))}
      </div>
      <button type="button" className="btn" onClick={skip} disabled={!!fb}>
        Skip this lock (S)
      </button>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && fb.text}
      </div>
      <div className="game__keys">Space or tap the dial to stop · S to skip</div>
    </div>
  )
}

export const securityDial: GameDef = {
  id: 'security-dial',
  name: 'Security',
  skills: ['reaction-time', 'attention'],
  howTo: `Stop the spinning pointer on the target digit ${HITS_TO_OPEN} times in a row to open each lock; a miss resets the lock, and you may skip it.`,
  duration: 180,
  targetRt: 2500,
  Component: SecurityDialGame satisfies ComponentType<GameProps>,
  details: dialDetails,
}
