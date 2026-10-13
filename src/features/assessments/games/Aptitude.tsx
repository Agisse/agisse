// The shared shell for classic aptitude items (SHL / Cappfinity / Sova / Saville / Talent Q / Watson-Glaser style):
// stimulus on the left, question and lettered options on the right, a worked explanation after each answer in practice mode.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GameProps } from '../engine/types'
import { useRounds } from './rounds'
import { shuffle } from './SequenceReasoning'
import './games.css'
import './aptitude.css'

/** Cycles through a bank in a fresh random order, so a session repeats an item only after it has shown them all. */
export function deck<T>(xs: T[], rand: () => number = Math.random) {
  let q: T[] = []
  let last: T | undefined
  return () => {
    if (!q.length) {
      q = shuffle(xs, rand)
      // A fresh order never starts with the item just shown.
      if (q.length > 1 && q[q.length - 1] === last) [q[0], q[q.length - 1]] = [q[q.length - 1]!, q[0]!]
    }
    return (last = q.pop()!)
  }
}

/**
 * One item at a time: submit records the trial; in practice mode the item stays up with its explanation until Next,
 * otherwise the next item follows at once.
 */
export function useItemLoop<T>(make: (level: number) => T, { level, mode, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [item, setItem] = useState(() => make(level))
  const [result, setResult] = useState<boolean | null>(null)
  const [seq, setSeq] = useState(0)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    shownAt.current = performance.now()
    itemLevel.current = levelRef.current
  }, [item, seq])
  const next = () => {
    setResult(null)
    setSeq((n) => n + 1)
    setItem(make(levelRef.current))
  }
  const submit = (correct: boolean, kind?: string) => {
    if (result !== null || r.done()) return
    onTrial({ correct, rt: performance.now() - shownAt.current, level: itemLevel.current, kind })
    if (r.count()) return
    if (feedback) setResult(correct)
    else next()
  }
  return { item, result, submit, next, seq }
}

const LETTERS = 'ABCDE'

/** The explanation panel plus Next; Enter also moves on. */
export function Explain({ ok, text, onNext }: { ok: boolean; text: ReactNode; onNext: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => btn.current?.focus({ preventScroll: true }), [])
  return (
    <div className={`apt__explain ${ok ? 'apt__explain--ok' : 'apt__explain--bad'}`} aria-live="polite">
      <p className="apt__verdict">{ok ? 'Correct' : 'Not quite'}</p>
      <div className="apt__why">{text}</div>
      <button ref={btn} type="button" className="btn btn--sm apt__next" onClick={onNext}>
        Next
      </button>
    </div>
  )
}

/**
 * A multiple-choice item: 1–5 or A–E pick an option. `picked` and the right answer are marked once `result` is set.
 * The parent keys this per item so the pick resets.
 */
export function Choices({ options, answer, result, onPick }: { options: ReactNode[]; answer: number; result: boolean | null; onPick: (i: number, correct: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  const pick = (i: number) => {
    if (result !== null || picked !== null || i >= options.length) return
    setPicked(i)
    onPick(i, i === answer)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const n = Number(e.key)
      if (n >= 1 && n <= 5) pick(n - 1)
      else if (/^[a-e]$/i.test(e.key)) pick(LETTERS.indexOf(e.key.toUpperCase()))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div className="apt__options" role="group" aria-label="Answer options">
      {options.map((o, i) => (
        <button
          key={i}
          type="button"
          className="apt__opt"
          data-state={result === null ? undefined : i === answer ? 'right' : i === picked ? 'wrong' : undefined}
          aria-pressed={picked === i}
          disabled={result !== null}
          onClick={() => pick(i)}
        >
          <span className="apt__letter" aria-hidden="true">
            {LETTERS[i]}
          </span>
          {o}
        </button>
      ))}
    </div>
  )
}

/** Stimulus left, question right; stacks on narrow screens. */
export function AptLayout({ stimulus, question, children, keys = '1–5 or A–E to answer · Enter for next' }: { stimulus: ReactNode; question: ReactNode; children: ReactNode; keys?: string }) {
  return (
    <div className="apt">
      <div className="apt__stim">{stimulus}</div>
      <div className="apt__side">
        <div className="apt__question">{question}</div>
        {children}
      </div>
      <div className="game__keys apt__keys">{keys}</div>
    </div>
  )
}
