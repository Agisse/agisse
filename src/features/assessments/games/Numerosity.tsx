import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './hirevue.css'

type Rand = () => number
export type Op = '+' | '−' | '×' | '÷'
export type NumItem = { op: Op; target: number; need: number; tiles: number[] }

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const pick = <T,>(xs: readonly T[], rand: Rand) => xs[Math.floor(rand() * xs.length)]
export const KEYS = 'ABCDEFGHIJKL'

/** Folds the tiles with the operator; − and ÷ start from the largest tile, so selection order never matters. */
export function combine(op: Op, xs: number[]): number {
  const s = [...xs].sort((a, b) => b - a)
  if (op === '+') return s.reduce((a, b) => a + b, 0)
  if (op === '×') return s.reduce((a, b) => a * b, 1)
  return s.slice(1).reduce((a, b) => (op === '−' ? a - b : a / b), s[0])
}

/** Right when exactly `need` tiles combine to the target. */
export const isSolution = (item: NumItem, picked: number[]) =>
  picked.length === item.need && new Set(picked).size === picked.length && Math.abs(combine(item.op, picked.map((i) => item.tiles[i])) - item.target) < 1e-9

/**
 * Operators unlock + (1), − (3), × (5), ÷ (7); operands needed 2 → 4 (× and ÷ stay at 2–3);
 * tiles 6 → 12; numbers up to 9 at level 1 and 50 at level 10.
 */
export function makeNumItem(level: number, rand: Rand = Math.random): NumItem {
  const ops: Op[] = level >= 7 ? ['+', '−', '×', '÷'] : level >= 5 ? ['+', '−', '×'] : level >= 3 ? ['+', '−'] : ['+']
  const op = pick(ops, rand)
  const need = Math.min(op === '+' || op === '−' ? 4 : 3, level <= 3 ? 2 : level <= 7 ? 3 : 4)
  const max = 5 + Math.round(level * 4.5)
  let operands: number[]
  if (op === '+') operands = Array.from({ length: need }, () => int(1, max, rand))
  else if (op === '−') {
    const rest = Array.from({ length: need - 1 }, () => int(1, Math.ceil(max / 2), rand))
    operands = [int(1, max, rand) + rest.reduce((a, b) => a + b, 0), ...rest]
  } else if (op === '×') operands = Array.from({ length: need }, () => int(2, need === 2 ? 4 + level : 3 + Math.floor(level / 3), rand))
  else {
    const divisors = Array.from({ length: need - 1 }, () => int(2, 3 + Math.floor(level / 2), rand))
    operands = [int(2, 9, rand) * divisors.reduce((a, b) => a * b, 1), ...divisors]
  }
  const target = combine(op, operands)
  const tiles = [...operands]
  const n = 5 + Math.ceil(level * 0.7)
  const hi = Math.max(...operands, op === '×' || op === '÷' ? 12 : max)
  while (tiles.length < n) tiles.push(int(1, hi, rand))
  // Fisher–Yates so the operands are not always first.
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  return { op, target, need, tiles }
}

/** One solution, for feedback. */
export function findSolution(item: NumItem): number[] | null {
  const n = item.tiles.length
  const go = (start: number, acc: number[]): number[] | null => {
    if (acc.length === item.need) return isSolution(item, acc) ? acc : null
    for (let i = start; i < n; i++) {
      const r = go(i + 1, [...acc, i])
      if (r) return r
    }
    return null
  }
  return go(0, [])
}

const OP_WORD: Record<Op, string> = { '+': 'add', '−': 'subtract from the largest', '×': 'multiply', '÷': 'divide the largest by the rest' }

function NumerosityGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [item, setItem] = useState(() => makeNumItem(level))
  const [picked, setPicked] = useState<number[]>([])
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const [score, setScore] = useState(0)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  const played = useRef(0)
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
        setPicked([])
        setItem(makeNumItem(levelRef.current))
      },
      feedback ? 1400 : 250,
    )
    return () => clearTimeout(t)
  }, [fb, feedback])

  function record(t: Trial) {
    onTrial(t)
    if (rounds && ++played.current >= rounds) onDone?.()
  }
  function toggle(i: number) {
    if (fb) return
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < item.need ? [...p, i] : p))
  }
  function submit() {
    if (fb || picked.length !== item.need) return
    const ok = isSolution(item, picked)
    record({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: item.op })
    if (ok) setScore((s) => s + 1)
    const sol = ok ? picked : findSolution(item)
    const vals = (sol ?? []).map((i) => item.tiles[i]).sort((a, b) => b - a)
    setFb({ ok, text: `${vals.join(` ${item.op} `)} = ${item.target}` })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = KEYS.indexOf(e.key.toUpperCase())
      if (k >= 0 && k < item.tiles.length && e.key.length === 1) toggle(k)
      else if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      } else if (e.key === 'Backspace') setPicked([])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Select {item.need} tiles and {OP_WORD[item.op]} to make the target · Score {score}
      </div>
      <div className="game__stimulus hv-target">
        <span className="hv-op">{item.op}</span> {item.target}
      </div>
      <div className="hv-tiles">
        {item.tiles.map((v, i) => (
          <button key={i} type="button" className="btn hv-tile" aria-pressed={picked.includes(i)} onClick={() => toggle(i)} disabled={!!fb}>
            <span className="hv-key">{KEYS[i]}</span>
            {v}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--ink" disabled={!!fb || picked.length !== item.need} onClick={submit}>
        Submit
      </button>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
      </div>
      <div className="game__keys">Letter keys toggle a tile · Enter submits · Backspace clears</div>
    </div>
  )
}

export const numerosity: GameDef = {
  id: 'numerosity',
  name: 'Numerosity',
  skills: ['numerical-speed'],
  howTo: 'Select the number tiles that make the target with the operator shown; solve as many as you can before time runs out.',
  duration: 180,
  targetRt: 7000,
  Component: NumerosityGame satisfies ComponentType<GameProps>,
}
