import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import { shuffle } from './SequenceReasoning'
import { Shape, type ShapeName } from './shapes'
import './games.css'
import './reasoning.css'
import './aon.css'

type Rand = () => number
/** grid: symbol index per cell, null = blank; q = the '?' cell. */
export type GapItem = { n: number; grid: (number | null)[]; q: number; answer: number; direct: boolean }
export const GAP_SHAPES: ShapeName[] = ['circle', 'square', 'triangle', 'diamond', 'star']

/** A random Latin square: a cyclic square with rows, columns and symbols shuffled. */
export function latin(n: number, rand: Rand): number[] {
  const [rows, cols, syms] = [shuffle([...Array(n).keys()], rand), shuffle([...Array(n).keys()], rand), shuffle([...Array(n).keys()], rand)]
  return Array.from({ length: n * n }, (_, i) => syms[(rows[Math.floor(i / n)]! + cols[i % n]!) % n]!)
}

/** Values the '?' cell takes across every Latin completion of the grid (stops early at two). */
export function qValues(n: number, grid: (number | null)[], q: number): Set<number> {
  const g = [...grid]
  g[q] = null
  const blanks = g.flatMap((v, i) => (v === null ? [i] : []))
  const out = new Set<number>()
  const ok = (i: number, v: number) => {
    const [r, c] = [Math.floor(i / n), i % n]
    for (let k = 0; k < n; k++) if (g[r * n + k] === v || g[k * n + c] === v) return false
    return true
  }
  const go = (k: number): void => {
    if (out.size > 1) return
    if (k === blanks.length) return void out.add(g[q]!)
    const i = blanks[k]!
    for (let v = 0; v < n; v++)
      if (ok(i, v)) {
        g[i] = v
        go(k + 1)
        g[i] = null
      }
  }
  go(0)
  return out
}

/** Candidates left for '?' by its own row and column alone. */
export const directCandidates = (n: number, grid: (number | null)[], q: number) => {
  const [r, c] = [Math.floor(q / n), q % n]
  const seen = new Set<number | null>()
  for (let k = 0; k < n; k++) [grid[r * n + k], grid[k * n + c]].forEach((v) => seen.add(v))
  return [...Array(n).keys()].filter((v) => !seen.has(v))
}

/** 4×4 to level 5, then 5×5; more blanks with level; from level 4 the '?' needs other cells worked out first. */
export function makeGapItem(level: number, rand: Rand = Math.random): GapItem {
  const n = level <= 5 ? 4 : 5
  const want = n === 4 ? 3 + level : 6 + (level - 5) * 2
  for (;;) {
    const sol = latin(n, rand)
    const q = Math.floor(rand() * n * n)
    const grid: (number | null)[] = [...sol]
    grid[q] = null
    let blanks = 0
    for (const i of shuffle([...Array(n * n).keys()], rand)) {
      if (i === q || blanks >= want) continue
      const v = grid[i]!
      grid[i] = null
      if (qValues(n, grid, q).size === 1) blanks++
      else grid[i] = v
    }
    const direct = directCandidates(n, grid, q).length === 1
    if (blanks < want - 1 || (level >= 4 && direct)) continue
    return { n, grid, q, answer: sol[q]!, direct }
  }
}

/** kind 'direct' | 'deduce'. */
export function gapDetails(trials: Trial[]) {
  const acc = (k: string) => {
    const xs = trials.filter((t) => t.kind === k)
    return xs.length ? Math.round((xs.filter((t) => t.correct).length / xs.length) * 1000) / 1000 : 0
  }
  return { directAccuracy: acc('direct'), deductionAccuracy: acc('deduce') }
}

function GapChallengeGame({ level, mode, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [item, setItem] = useState(() => makeGapItem(level))
  const [fb, setFb] = useState<number | null>(null)
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
    if (fb === null) return
    const t = setTimeout(
      () => {
        setFb(null)
        setItem(makeGapItem(levelRef.current))
      },
      feedback ? 1400 : 200,
    )
    return () => clearTimeout(t)
  }, [fb, feedback])

  function choose(v: number) {
    if (fb !== null || v >= item.n) return
    onTrial({ correct: v === item.answer, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: item.direct ? 'direct' : 'deduce' })
    if (!r.count()) setFb(v)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = Number(e.key)
      if (k >= 1 && k <= item.n) choose(k - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Each row and column holds every shape once. Which shape goes in the ?
      </div>
      <div className="aon-latin" style={{ gridTemplateColumns: `repeat(${item.n}, auto)` }} role="img" aria-label={`${item.n} by ${item.n} grid`}>
        {item.grid.map((v, i) => (
          <span key={i} className="aon-latin__cell" data-q={i === item.q ? 'true' : undefined}>
            {i === item.q ? (fb !== null && feedback ? <Shape name={GAP_SHAPES[item.answer]!} size={32} /> : '?') : v !== null && <Shape name={GAP_SHAPES[v]!} size={32} />}
          </span>
        ))}
      </div>
      <div className="game__choices">
        {GAP_SHAPES.slice(0, item.n).map((s, v) => (
          <button key={s} type="button" className="btn game__choice rsn-choice" aria-label={s} data-answer={fb !== null && feedback && v === item.answer ? 'true' : undefined} disabled={fb !== null} onClick={() => choose(v)}>
            <span className="rsn-key">{v + 1}</span> <Shape name={s} size={28} />
          </button>
        ))}
      </div>
      <div className={`game__feedback ${fb !== null && feedback ? (fb === item.answer ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb !== null && feedback && (fb === item.answer ? 'Right' : `Not quite: it is the ${GAP_SHAPES[item.answer]}${item.direct ? '' : '; fill the cells it depends on first'}`)}
      </div>
      <div className="game__keys">1–{item.n} to answer</div>
    </div>
  )
}

export const gapChallenge: GameDef = {
  id: 'gap-challenge',
  name: 'Gap challenge',
  skills: ['logical-reasoning'],
  howTo: 'Every row and column contains each shape exactly once; work out which shape belongs in the question mark.',
  duration: 360,
  targetRt: 12000,
  Component: GapChallengeGame satisfies ComponentType<GameProps>,
  details: gapDetails,
}
