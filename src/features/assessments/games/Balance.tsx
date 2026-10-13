import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './arctic.css'
import { shuffle } from './SequenceReasoning'

type Rand = () => number
/** [shape index, how many]. */
export type Count = [number, number]
export type Scale = { left: Count[]; right: Count[] }
export type BalanceItem = {
  weights: number[]
  /** Balanced reference scales; together they fix every weight ratio. */
  refs: Scale[]
  /** The target's left pan; the player builds the right pan from `allowed` shapes. */
  target: Count[]
  allowed: number[]
  /** A smallest balancing right pan, as counts per shape index. */
  solution: number[]
}

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
export const MAX_PER_SHAPE = 6
export const panWeight = (w: number[], pan: Count[]) => pan.reduce((s, [i, n]) => s + w[i]! * n, 0)

/** Shapes: 3 to level 3, 4 to level 7, then 5. Two-shape reference pans from level 6, a two-shape target pan from 5. */
export function makeBalanceItem(level: number, rand: Rand = Math.random): BalanceItem {
  const k = level <= 3 ? 3 : level <= 7 ? 4 : 5
  const maxCoef = level >= 4 ? 4 : 3
  // ponytail: rejection loop; small coefficients keep acceptance high, so it ends within a few tries.
  for (;;) {
    const w = [int(1, 4, rand)]
    const refs: Scale[] = []
    for (let j = 1; j < k && w.length === j; j++) {
      for (let tries = 0; tries < 50; tries++) {
        if (level >= 6 && j >= 2 && rand() < 0.5) {
          const a = int(0, j - 1, rand)
          const b = (a + int(1, j - 1, rand)) % j
          const c = int(1, 3, rand)
          const s = w[a]! + w[b]!
          if (s % c || w.includes(s / c)) continue
          w.push(s / c)
          refs.push({ left: [[a, 1], [b, 1]], right: [[j, c]] })
        } else {
          const i = int(0, j - 1, rand)
          const [m, n] = [int(1, maxCoef, rand), int(1, maxCoef, rand)]
          const v = (w[i]! * m) / n
          if (m === n || !Number.isInteger(v) || w.includes(v) || v > 30) continue
          w.push(v)
          refs.push({ left: [[j, n]], right: [[i, m]] })
        }
        break
      }
    }
    if (w.length < k) continue

    const order = shuffle(Array.from({ length: k }, (_, i) => i), rand)
    const nLeft = level >= 5 && k >= 4 ? 2 : 1
    const target: Count[] = order.slice(0, nLeft).map((i) => [i, int(1, 3, rand)])
    const allowed = order.slice(nLeft).sort((a, b) => a - b)
    const goal = panWeight(w, target)
    let best = null as number[] | null
    let bestN = Infinity
    const counts = new Array<number>(k).fill(0)
    const walk = (d: number, sum: number, total: number) => {
      if (sum > goal) return
      if (d === allowed.length) {
        if (sum === goal && total < bestN) [best, bestN] = [[...counts], total]
        return
      }
      for (let c = 0; c <= MAX_PER_SHAPE; c++) {
        counts[allowed[d]!] = c
        walk(d + 1, sum + c * w[allowed[d]!]!, total + c)
      }
      counts[allowed[d]!] = 0
    }
    walk(0, 0, 0)
    if (!best || bestN > 8) continue
    return {
      weights: w,
      refs: shuffle(refs, rand).map((r) => (rand() < 0.5 ? { left: r.right, right: r.left } : r)),
      target,
      allowed,
      solution: best,
    }
  }
}

/** Right if the built pan uses only allowed shapes, at least one, and weighs the same as the target pan. */
export function balances(item: BalanceItem, counts: number[]) {
  if (counts.some((c, i) => c > 0 && !item.allowed.includes(i)) || !counts.some((c) => c > 0)) return false
  return counts.reduce((s, c, i) => s + c * item.weights[i]!, 0) === panWeight(item.weights, item.target)
}

export function balanceDetails(trials: Trial[]) {
  const t = trials.filter((x) => x.kind === 'balance')
  return { accuracy: t.length ? Math.round((t.filter((x) => x.correct).length / t.length) * 1000) / 1000 : 0 }
}

export const SHAPE_NAMES = ['circle', 'square', 'triangle', 'star', 'hexagon'] as const
function ShapeIcon({ i }: { i: number }) {
  const s = SHAPE_NAMES[i]
  return (
    <svg viewBox="0 0 24 24" className="arc-shape" data-shape={s} aria-hidden="true">
      {s === 'circle' && <circle cx="12" cy="12" r="9" />}
      {s === 'square' && <rect x="3.5" y="3.5" width="17" height="17" />}
      {s === 'triangle' && <polygon points="12,2.5 22,20.5 2,20.5" />}
      {s === 'star' && <polygon points="12,1.5 14.9,8.5 22.5,9 16.7,14 18.5,21.5 12,17.5 5.5,21.5 7.3,14 1.5,9 9.1,8.5" />}
      {s === 'hexagon' && <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />}
    </svg>
  )
}
const describePan = (pan: Count[]) => pan.filter(([, n]) => n).map(([i, n]) => `${n} ${SHAPE_NAMES[i]}${n > 1 ? 's' : ''}`).join(' and ') || 'nothing'

function Pan({ pan }: { pan: Count[] }) {
  return (
    <span className="arc-pan">
      {pan.flatMap(([i, n]) => Array.from({ length: n }, (_, j) => <ShapeIcon key={`${i}-${j}`} i={i} />))}
    </span>
  )
}
function ScaleView({ s, tilt = 0, label }: { s: Scale; tilt?: number; label: string }) {
  return (
    <div className="arc-scale" role="img" aria-label={label}>
      <div className="arc-scale__pans">
        <Pan pan={s.left} />
        <Pan pan={s.right} />
      </div>
      <div className="arc-scale__beam" data-tilt={tilt} />
      <div className="arc-scale__post" />
    </div>
  )
}

function BalanceGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [item, setItem] = useState(() => makeBalanceItem(level))
  const [picks, setPicks] = useState<number[]>([])
  const [fb, setFb] = useState<{ ok: boolean; tilt: number } | null>(null)
  const done = useRef(0)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    shownAt.current = performance.now()
    itemLevel.current = levelRef.current
  }, [item])
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(
      () => {
        setFb(null)
        setPicks([])
        setItem(makeBalanceItem(levelRef.current))
      },
      feedback ? 2200 : 500,
    )
    return () => clearTimeout(t)
  }, [fb, feedback])

  const counts = item.weights.map((_, i) => picks.filter((p) => p === i).length)
  const right: Count[] = item.allowed.map((i) => [i, counts[i]!])
  const add = (i: number) => !fb && counts[i]! < MAX_PER_SHAPE && setPicks([...picks, i])
  const remove = (i: number) => {
    const at = picks.lastIndexOf(i)
    if (!fb && at >= 0) setPicks(picks.filter((_, j) => j !== at))
  }
  function submit() {
    if (fb || !picks.length) return
    const ok = balances(item, counts)
    onTrial({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: 'balance' })
    const diff = panWeight(item.weights, item.target) - panWeight(item.weights, right)
    setFb({ ok, tilt: Math.sign(diff) })
    if (rounds && ++done.current >= rounds) onDone?.()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const n = Number(e.key)
      if (n >= 1 && n <= item.allowed.length) add(item.allowed[n - 1]!)
      else if (e.key === 'Backspace') {
        e.preventDefault()
        if (!fb) setPicks(picks.slice(0, -1))
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const explain = `Weights ${item.weights.map((w, i) => `${SHAPE_NAMES[i]} ${w}`).join(', ')}: e.g. ${describePan(item.allowed.map((i) => [i, item.solution[i]!]))}`
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        These scales balance. Work out the weights, then balance the last scale.
      </div>
      <div className="arc-refs">
        {item.refs.map((r, i) => (
          <ScaleView key={i} s={r} label={`${describePan(r.left)} balance ${describePan(r.right)}`} />
        ))}
      </div>
      <ScaleView s={{ left: item.target, right }} tilt={fb?.tilt ?? 0} label={`Target: ${describePan(item.target)} against ${describePan(right)}`} />
      <div className="arc-pickers">
        {item.allowed.map((i, k) => (
          <div key={i} className="arc-picker">
            <button type="button" className="btn" disabled={!!fb || !counts[i]} onClick={() => remove(i)} aria-label={`Remove a ${SHAPE_NAMES[i]}`}>
              −
            </button>
            <button type="button" className="btn arc-picker__add" disabled={!!fb} onClick={() => add(i)} aria-label={`Add a ${SHAPE_NAMES[i]} (${k + 1})`}>
              <span className="rsn-key">{k + 1}</span>
              <ShapeIcon i={i} /> {counts[i]}
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--primary" disabled={!!fb || !picks.length} onClick={submit}>
          Check
        </button>
      </div>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Balanced' : 'Not balanced'}. ${explain}`}
      </div>
      <div className="game__keys">1–{item.allowed.length} add a shape · Backspace removes · Enter checks</div>
    </div>
  )
}

export const balance: GameDef = {
  id: 'balance',
  name: 'Balance',
  skills: ['logical-reasoning'],
  howTo: 'Use the balanced scales to work out how heavy each shape is, then add shapes to balance the last scale.',
  duration: 300,
  targetRt: 20000,
  Component: BalanceGame satisfies ComponentType<GameProps>,
  details: balanceDetails,
}
