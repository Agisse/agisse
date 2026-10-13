import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps } from '../engine/types'
import './core.css'

type Rand = () => number
export type NumProblem =
  | { kind: 'calc'; text: string; answer: number; explain: string }
  | { kind: 'cmp'; left: string; right: string; answer: 0 | 1; explain: string }

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const pick = <T,>(xs: readonly T[], rand: Rand): T => xs[Math.floor(rand() * xs.length)]!
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** Operand ranges grow with level: single digits at 1, two-digit by two-digit near 10. */
function operands(level: number, rand: Rand) {
  return [int(2, 6 + level * 3, rand), int(2, level < 4 ? 9 : 8 + level, rand)] as const
}

/** A base y for which p% of y is a whole number. */
function cleanBase(p: number, level: number, rand: Rand) {
  const step = 100 / gcd(p, 100)
  return step * int(1, Math.max(2, Math.floor((level * 40) / step)), rand)
}

function percentPool(level: number) {
  return level < 5 ? [10, 20, 25, 50] : level < 8 ? [5, 10, 15, 20, 25, 30, 40, 50, 75] : [5, 12, 15, 35, 45, 60, 75, 80, 120]
}

/** Item types unlock with level: × ÷ from 1, percentages from 3, comparisons from 4, two-step from 7. */
export function makeProblem(level: number, rand: Rand = Math.random): NumProblem {
  const kinds = ['mul', 'div', ...(level >= 3 ? ['pct'] : []), ...(level >= 4 ? ['cmp'] : []), ...(level >= 7 ? ['multi'] : [])]
  const kind = pick(kinds, rand)
  const [a, b] = operands(level, rand)
  if (kind === 'mul') return { kind: 'calc', text: `${a} × ${b}`, answer: a * b, explain: `${a} × ${b} = ${a * b}` }
  if (kind === 'div') return { kind: 'calc', text: `${a * b} ÷ ${b}`, answer: a, explain: `${a * b} ÷ ${b} = ${a}` }
  if (kind === 'pct') {
    const p = pick(percentPool(level), rand)
    const y = cleanBase(p, level, rand)
    const r = (p * y) / 100
    return { kind: 'calc', text: `${p}% of ${y}`, answer: r, explain: `${p}% of ${y} = ${r}` }
  }
  if (kind === 'cmp') {
    const p = pick(percentPool(level), rand)
    const y = cleanBase(p, level, rand)
    const more = rand() < 0.5 || p >= 100
    const exact = more ? y + (p * y) / 100 : y - (p * y) / 100
    // Closer values at higher levels, but never equal.
    const spread = Math.max(1, Math.round(exact * (0.12 - level * 0.01)))
    const other = exact + (rand() < 0.5 ? -1 : 1) * int(1, spread, rand)
    const phrase = `${p}% ${more ? 'more' : 'less'} than ${y}`
    const phraseFirst = rand() < 0.5
    const [left, right] = phraseFirst ? [phrase, String(other)] : [String(other), phrase]
    const leftVal = phraseFirst ? exact : other
    const rightVal = phraseFirst ? other : exact
    return { kind: 'cmp', left, right, answer: leftVal > rightVal ? 0 : 1, explain: `${phrase} = ${exact}` }
  }
  const c = int(2, 10 + level * 4, rand)
  if (rand() < 0.5) return { kind: 'calc', text: `${a} × ${b} + ${c}`, answer: a * b + c, explain: `${a} × ${b} + ${c} = ${a * b} + ${c} = ${a * b + c}` }
  const s = int(2, 9, rand)
  return { kind: 'calc', text: `(${a} + ${c}) × ${s}`, answer: (a + c) * s, explain: `(${a} + ${c}) × ${s} = ${a + c} × ${s} = ${(a + c) * s}` }
}

export const isCorrect = (p: NumProblem, answer: number) => answer === p.answer

function NumericalSpeedGame({ level, feedback, onTrial }: GameProps) {
  const [problem, setProblem] = useState(() => makeProblem(level))
  const [typed, setTyped] = useState('')
  const [fb, setFb] = useState<{ ok: boolean; text: string; ms: number } | null>(null)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    shownAt.current = performance.now()
    itemLevel.current = levelRef.current
  }, [problem])
  // Pause after an answer (feedback, or one tick so the parent's new level lands in levelRef), then the next item.
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(() => {
      setFb(null)
      setProblem(makeProblem(levelRef.current))
    }, fb.ms)
    return () => clearTimeout(t)
  }, [fb])

  function answer(value: number) {
    if (fb) return
    const correct = isCorrect(problem, value)
    onTrial({ correct, rt: performance.now() - shownAt.current, level: itemLevel.current })
    setTyped('')
    setFb({ ok: correct, text: problem.explain, ms: feedback ? 900 : 0 })
  }

  useEffect(() => {
    if (problem.kind !== 'cmp') return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === '1' || e.key === 'ArrowLeft') answer(0)
      else if (e.key === '2' || e.key === 'ArrowRight') answer(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {problem.kind === 'cmp' ? 'Which is larger?' : 'Work it out'}
      </div>
      {problem.kind === 'cmp' ? (
        <div className="game__choices">
          <button type="button" className="btn game__choice core-cmp" onClick={() => answer(0)} disabled={!!fb}>
            {problem.left}
          </button>
          <button type="button" className="btn game__choice core-cmp" onClick={() => answer(1)} disabled={!!fb}>
            {problem.right}
          </button>
        </div>
      ) : (
        <>
          <div className="game__stimulus">{problem.text}</div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (typed.trim() !== '' && Number.isFinite(Number(typed))) answer(Number(typed))
            }}
          >
            <input
              className="field__input game__input"
              inputMode="numeric"
              autoFocus
              aria-label="Answer"
              value={typed}
              readOnly={!!fb}
              onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))}
            />
          </form>
        </>
      )}
      <div className={`game__feedback ${fb ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
      </div>
      <div className="game__keys">{problem.kind === 'cmp' ? '1 or ← left · 2 or → right' : 'Type the answer · Enter to submit'}</div>
    </div>
  )
}

export const numericalSpeed: GameDef = {
  id: 'numerical-speed',
  name: 'Numerical speed',
  skills: ['numerical-speed', 'numerical-accuracy'],
  howTo: 'Solve each sum as quickly and accurately as you can; for comparisons, pick the larger value.',
  duration: 120,
  targetRt: 4000,
  Component: NumericalSpeedGame satisfies ComponentType<GameProps>,
}
