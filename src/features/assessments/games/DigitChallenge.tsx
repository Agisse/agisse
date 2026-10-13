import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import './games.css'
import './reasoning.css'
import './aon.css'

type Rand = () => number
export type Op = '+' | '−' | '×' | '÷'
export type DigitEq = { ops: Op[]; target: number; example: number[] }

/** Evaluates n0 op0 n1 op1 … with × and ÷ first; null when a division is not exact. */
export function evalExpr(nums: number[], ops: Op[]): number | null {
  const terms = [nums[0]!]
  const signs: number[] = [1]
  for (let i = 0; i < ops.length; i++) {
    const [op, n] = [ops[i]!, nums[i + 1]!]
    if (op === '×') terms[terms.length - 1]! *= n
    else if (op === '÷') {
      const last = terms[terms.length - 1]!
      if (last % n) return null
      terms[terms.length - 1] = last / n
    } else {
      terms.push(n)
      signs.push(op === '+' ? 1 : -1)
    }
  }
  return terms.reduce((s, t, i) => s + signs[i]! * t, 0)
}

/** Blanks 2 (levels 1–3), 3 (4–7), 4 (8–10); × from level 3, ÷ from level 6. Built from real digits, so a solution exists. */
export function makeDigitEq(level: number, rand: Rand = Math.random): DigitEq {
  const n = level <= 3 ? 2 : level <= 7 ? 3 : 4
  const pool: Op[] = ['+', '−', ...(level >= 3 ? (['×'] as Op[]) : []), ...(level >= 6 ? (['÷'] as Op[]) : [])]
  for (;;) {
    const digits: number[] = []
    while (digits.length < n) {
      const d = 1 + Math.floor(rand() * 9)
      if (!digits.includes(d)) digits.push(d)
    }
    const ops = Array.from({ length: n - 1 }, () => pool[Math.floor(rand() * pool.length)]!)
    if (level >= 4 && !ops.some((o) => o === '×' || o === '÷')) continue
    const target = evalExpr(digits, ops)
    if (target !== null && target >= 1) return { ops, target, example: digits }
  }
}

/** Every blank filled with a distinct digit 1–9 and the equation holds. */
export const isValidFill = (eq: DigitEq, digits: number[]) =>
  digits.length === eq.ops.length + 1 && new Set(digits).size === digits.length && digits.every((d) => Number.isInteger(d) && d >= 1 && d <= 9) && evalExpr(digits, eq.ops) === eq.target

/** All valid fills (at most 9·8·7·6 tries). */
export function solutions(eq: DigitEq): number[][] {
  const out: number[][] = []
  const go = (acc: number[]) => {
    if (acc.length === eq.ops.length + 1) return void (evalExpr(acc, eq.ops) === eq.target && out.push(acc))
    for (let d = 1; d <= 9; d++) if (!acc.includes(d)) go([...acc, d])
  }
  go([])
  return out
}

/** kind = number of blanks. */
export function digitDetails(trials: Trial[]) {
  const acc = (k: string) => {
    const xs = trials.filter((t) => t.kind === k)
    return xs.length ? Math.round((xs.filter((t) => t.correct).length / xs.length) * 1000) / 1000 : 0
  }
  return { twoBlankAccuracy: acc('2'), threeBlankAccuracy: acc('3'), fourBlankAccuracy: acc('4') }
}

const show = (eq: DigitEq, fill: (number | null)[]) => fill.map((d, i) => `${d ?? '_'}${i < eq.ops.length ? ` ${eq.ops[i]} ` : ''}`).join('') + ` = ${eq.target}`

function DigitChallengeGame({ level, mode, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [eq, setEq] = useState(() => makeDigitEq(level))
  const [fill, setFill] = useState<(number | null)[]>(() => eq.example.map(() => null))
  const [fb, setFb] = useState<boolean | null>(null)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    shownAt.current = performance.now()
    itemLevel.current = levelRef.current
  }, [eq])
  useEffect(() => {
    if (fb === null) return
    const t = setTimeout(
      () => {
        const next = makeDigitEq(levelRef.current)
        setFb(null)
        setFill(next.example.map(() => null))
        setEq(next)
      },
      feedback ? 1600 : 200,
    )
    return () => clearTimeout(t)
  }, [fb, feedback])

  function put(d: number) {
    if (fb !== null || fill.includes(d)) return
    const i = fill.indexOf(null)
    if (i >= 0) setFill(fill.map((x, j) => (j === i ? d : x)))
  }
  function submit() {
    if (fb !== null || fill.includes(null)) return
    const ok = isValidFill(eq, fill as number[])
    onTrial({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: String(fill.length) })
    if (!r.count()) setFb(ok)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const n = Number(e.key)
      if (n >= 1 && n <= 9) put(n)
      else if (e.key === 'Backspace') {
        const i = fill.findLastIndex((x) => x !== null)
        if (i >= 0 && fb === null) setFill(fill.map((x, j) => (j === i ? null : x)))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Fill the blanks with different digits 1–9 to make the equation true.
      </div>
      <div className="game__stimulus aon-eq" aria-label={show(eq, fill)}>
        {fill.map((d, i) => (
          <span key={i}>
            <button type="button" className="aon-slot" disabled={fb !== null} onClick={() => setFill(fill.map((x, j) => (j === i ? null : x)))} aria-label={d ? `Clear ${d}` : 'Empty blank'}>
              {d ?? ''}
            </button>
            {i < eq.ops.length && <span className="aon-op">{eq.ops[i]}</span>}
          </span>
        ))}
        <span className="aon-op">= {eq.target}</span>
      </div>
      <div className="aon-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" className="btn rsn-choice" disabled={fb !== null || fill.includes(d)} onClick={() => put(d)}>
            {d}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--ink" disabled={fb !== null || fill.includes(null)} onClick={submit}>
        Check
      </button>
      <div className={`game__feedback ${fb !== null && feedback ? (fb ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb !== null && feedback && (fb ? 'Right' : `Not quite: one answer is ${show(eq, eq.example)}`)}
      </div>
      <div className="game__keys">Digits to fill · Backspace to clear · Enter to check</div>
    </div>
  )
}

export const digitChallenge: GameDef = {
  id: 'digit-challenge',
  name: 'Digit challenge',
  skills: ['numerical-accuracy'],
  howTo: 'Fill every blank with a different digit from 1 to 9 so the equation is true; any correct answer counts.',
  duration: 360,
  targetRt: 15000,
  Component: DigitChallengeGame satisfies ComponentType<GameProps>,
  details: digitDetails,
}
