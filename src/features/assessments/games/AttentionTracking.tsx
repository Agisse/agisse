import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './reasoning.css'

type Rand = () => number
export type Ball = { x: number; y: number; vx: number; vy: number }
export type TrackRound = { balls: Ball[]; targets: number[]; moveMs: number }

/** Arena in logical units; the view scales it to the available width. */
export const W = 480
export const H = 320
export const R = 14
const CUE_MS = 2000

/** 6 → 12 objects, 2 → 5 targets, 74 → 200 units/s, 5.3 → 8 s of motion. Reduced motion halves the speed. */
export function makeRound(level: number, rand: Rand = Math.random, reduced = false): TrackRound {
  const n = 6 + Math.round(((level - 1) * 6) / 9)
  const t = Math.min(5, 2 + Math.floor((level - 1) / 3))
  const speed = (60 + level * 14) * (reduced ? 0.5 : 1)
  const balls: Ball[] = []
  while (balls.length < n) {
    const x = R + rand() * (W - 2 * R)
    const y = R + rand() * (H - 2 * R)
    if (balls.some((b) => Math.hypot(b.x - x, b.y - y) < 3 * R)) continue
    const a = rand() * 2 * Math.PI
    balls.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed })
  }
  const targets = new Set<number>()
  while (targets.size < t) targets.add(Math.floor(rand() * n))
  return { balls, targets: [...targets], moveMs: 5000 + level * 300 }
}

const bounce = (p: number, v: number, max: number): [number, number] =>
  p < R ? [2 * R - p, Math.abs(v)] : p > max - R ? [2 * (max - R) - p, -Math.abs(v)] : [p, v]

/** Advance dt seconds, reflecting off the walls and off each other (equal masses: swap the velocity along the line between centres). */
export function step(balls: Ball[], dt: number): Ball[] {
  const next = balls.map((b) => {
    const [x, vx] = bounce(b.x + b.vx * dt, b.vx, W)
    const [y, vy] = bounce(b.y + b.vy * dt, b.vy, H)
    return { x, y, vx, vy }
  })
  for (let i = 0; i < next.length; i++)
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i]!
      const b = next[j]!
      const [dx, dy] = [b.x - a.x, b.y - a.y]
      const d = Math.hypot(dx, dy)
      if (!d || d >= 2 * R) continue
      const [nx, ny] = [dx / d, dy / d]
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
      if (closing <= 0) continue
      a.vx -= closing * nx
      a.vy -= closing * ny
      b.vx += closing * nx
      b.vy += closing * ny
    }
  return next
}

/** No two balls touch: an overlap at the stop would hide which one was the target, and one could not be clicked. */
export const apart = (balls: Ball[]) => balls.every((a, i) => balls.slice(i + 1).every((b) => Math.hypot(a.x - b.x, a.y - b.y) >= 2 * R))

export const hitsOf = (targets: number[], picked: number[]) => picked.filter((p) => targets.includes(p)).length

export function trackingDetails(trials: Trial[]) {
  const rates = trials.map((t) => (t.kind ?? '').split('/').map(Number)).filter((x) => x[1]! > 0).map(([h, n]) => h! / n!)
  return { meanHitRate: rates.length ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 1000) / 1000 : 0 }
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function AttentionTrackingGame({ level, feedback, onTrial }: GameProps) {
  const [round, setRound] = useState(() => makeRound(level, Math.random, reducedMotion()))
  const [balls, setBalls] = useState(round.balls)
  const [phase, setPhase] = useState<'cue' | 'move' | 'pick' | 'fb'>('cue')
  const [picked, setPicked] = useState<number[]>([])
  const arenaRef = useRef<HTMLDivElement>(null)
  const pickAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    itemLevel.current = levelRef.current
    const t = setTimeout(() => setPhase('move'), CUE_MS)
    return () => clearTimeout(t)
  }, [round])
  useEffect(() => {
    if (phase !== 'move') return
    let raf = 0
    let current = round.balls
    const start = performance.now()
    let prev = start
    const frame = (now: number) => {
      current = step(current, Math.min(0.05, (now - prev) / 1000))
      prev = now
      setBalls(current)
      // Motion runs its time, then on until the balls are apart (3 s at most).
      if (now - start >= round.moveMs && (apart(current) || now - start >= round.moveMs + 3000)) {
        pickAt.current = performance.now()
        setPhase('pick')
      } else raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, round])
  useEffect(() => {
    if (phase !== 'fb') return
    const t = setTimeout(
      () => {
        const next = makeRound(levelRef.current, Math.random, reducedMotion())
        setPicked([])
        setBalls(next.balls)
        setRound(next)
        setPhase('cue')
      },
      feedback ? 1200 : 300,
    )
    return () => clearTimeout(t)
  }, [phase, feedback])

  const T = round.targets.length
  function toggle(i: number) {
    if (phase !== 'pick') return
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < T ? [...p, i] : p))
  }
  function submit() {
    if (phase !== 'pick' || picked.length !== T) return
    const hits = hitsOf(round.targets, picked)
    onTrial({ correct: hits === T, rt: performance.now() - pickAt.current, level: itemLevel.current, kind: `${hits}/${T}` })
    setPhase('fb')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'Enter' && picked.length === T) {
        e.preventDefault()
        submit()
        return
      }
      const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key]
      if (!d || phase !== 'pick') return
      e.preventDefault()
      const btns = [...(arenaRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      const i = btns.indexOf(document.activeElement as HTMLButtonElement)
      btns[i < 0 ? 0 : (i + d + btns.length) % btns.length]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hits = hitsOf(round.targets, picked)
  const reveal = phase === 'fb' && feedback
  const prompt = {
    cue: `Watch the ${T} marked circles`,
    move: 'Keep your eyes on them…',
    pick: `Select the ${T} circles you followed (${picked.length}/${T})`,
    fb: 'Next round…',
  }[phase]
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {prompt}
      </div>
      <div ref={arenaRef} className="rsn-arena">
        {balls.map((b, i) => {
          const target = round.targets.includes(i)
          return (
            <button
              key={i}
              type="button"
              className="rsn-ball"
              style={{ left: `${((b.x - R) / W) * 100}%`, top: `${((b.y - R) / H) * 100}%`, width: `${((2 * R) / W) * 100}%`, height: `${((2 * R) / H) * 100}%` }}
              data-on={phase === 'cue' || reveal ? target : picked.includes(i)}
              data-wrong={reveal && picked.includes(i) && !target ? 'true' : undefined}
              aria-pressed={phase === 'pick' ? picked.includes(i) : undefined}
              aria-label={`Circle ${i + 1}`}
              disabled={phase !== 'pick'}
              onClick={() => toggle(i)}
            />
          )
        })}
      </div>
      <button type="button" className="btn btn--ink" disabled={phase !== 'pick' || picked.length !== T} onClick={submit}>
        Done
      </button>
      <div className={`game__feedback ${reveal ? (hits === T ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {reveal && (hits === T ? `Right: all ${T} found` : `Not quite: ${hits} of ${T}; the targets are shown`)}
      </div>
      <div className="game__keys">Arrows to move · Space to select · Enter when {T} are selected</div>
    </div>
  )
}

export const attentionTracking: GameDef = {
  id: 'attention-tracking',
  name: 'Attention tracking',
  skills: ['attention'],
  howTo: 'Note the marked circles, follow them while all circles move, then select them once they stop.',
  duration: 150,
  targetRt: 6000,
  Component: AttentionTrackingGame satisfies ComponentType<GameProps>,
  details: trackingDetails,
}
