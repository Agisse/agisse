import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import './core.css'
import './variants.css'

type Rand = () => number
export type SeqMode = 'digits' | 'symbols' | 'grid'
/** items are 0–8: the digit 1–9, the symbol at that index, or the 3×3 cell. */
export type Sequence = { mode: SeqMode; items: number[] }

export const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚', '◐', '▼', '♣'] as const

export const seqLength = (level: number) => 3 + Math.floor(level / 2)
/** How long each item stays on screen; a 200ms blank follows so repeats stay visible. */
export const stepMs = (level: number) => Math.max(450, 900 - level * 45)
export const modeFor = (level: number): SeqMode => (level <= 3 ? 'digits' : level <= 6 ? 'symbols' : 'grid')

export function makeSequence(level: number, rand: Rand = Math.random): Sequence {
  const items: number[] = []
  for (let i = 0; i < seqLength(level); i++) {
    // No immediate repeats: a doubled item is a perception test, not a memory one.
    let x: number
    do x = Math.floor(rand() * 9)
    while (x === items[i - 1])
    items.push(x)
  }
  return { mode: modeFor(level), items }
}

export const isCorrect = (seq: Sequence, input: number[]) => input.length === seq.items.length && input.every((x, i) => x === seq.items[i])

export const label = (mode: SeqMode, x: number) => (mode === 'digits' ? String(x + 1) : mode === 'symbols' ? SYMBOLS[x]! : `cell ${x + 1}`)

function Grid({ on, onPick }: { on?: number; onPick?: (i: number) => void }) {
  return (
    <div className="game__grid core-grid3">
      {Array.from({ length: 9 }, (_, i) =>
        onPick ? (
          <button key={i} type="button" className="game__cell core-cellbtn" aria-label={`Cell ${i + 1}`} onClick={() => onPick(i)}>
            <span className="core-cellkey">{i + 1}</span>
          </button>
        ) : (
          <div key={i} className="game__cell" data-on={i === on} />
        ),
      )}
    </div>
  )
}

type Phase = { name: 'show'; i: number; blank: boolean } | { name: 'recall' } | { name: 'pause'; ok: boolean; ms: number }

// Span variants: Digitspan (HireVue: letters and digits, sometimes backwards) and Digits (pymetrics: forward digits).
/** Digitspan symbols: letters and digits without the look-alikes 0/O and 1/I. */
export const SPAN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const DIGIT_CHARS = '0123456789'
export const START_SPAN = 3
export const MIN_SPAN = 2
/** Digits ends a simulation after this many wrong answers in a row. */
export const DIGITS_MAX_MISSES = 3

/** A span of `len` symbols from `chars`, no immediate repeats. */
export function makeSpan(len: number, chars: string, rand: Rand = Math.random): string[] {
  const items: string[] = []
  while (items.length < len) {
    const x = chars[Math.floor(rand() * chars.length)]!
    if (x !== items[items.length - 1]) items.push(x)
  }
  return items
}
/** +1 symbol after a right answer, −1 after a wrong one. */
export const nextSpanLen = (len: number, ok: boolean) => (ok ? len + 1 : Math.max(MIN_SPAN, len - 1))
/** Digitspan asks for reverse recall on 40% of items after the first two; it is announced before the sequence. */
export const isReverse = (round: number, rand: Rand = Math.random) => round >= 2 && rand() < 0.4
export const spanAnswer = (items: string[], reverse: boolean) => (reverse ? [...items].reverse() : items).join('')
/** Typed answers ignore case, spaces and separators. */
export const normalizeSpan = (typed: string) => typed.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Span trials are tagged 'fwd:<len>' or 'rev:<len>'; the plain sequence game has no tags and no details. */
export function spanDetails(trials: Trial[]): Record<string, number> {
  const span = trials.map((t) => ({ t, m: t.kind?.match(/^(fwd|rev):(\d+)$/) })).filter((x) => x.m)
  if (!span.length) return {}
  const acc = (dir: string) => {
    const ts = span.filter((x) => x.m![1] === dir)
    return ts.length ? Math.round((ts.filter((x) => x.t.correct).length / ts.length) * 1000) / 1000 : 0
  }
  return {
    maxSpan: Math.max(0, ...span.filter((x) => x.t.correct).map((x) => Number(x.m![2]))),
    forwardAccuracy: acc('fwd'),
    ...(span.some((x) => x.m![1] === 'rev') ? { backwardAccuracy: acc('rev') } : {}),
  }
}

type SpanPhase = { name: 'cue' } | { name: 'show'; i: number; blank: boolean } | { name: 'recall' } | { name: 'pause'; ok: boolean; ms: number }

function SpanGame({ level, feedback, onTrial, variant, ...props }: GameProps) {
  const rr = useRounds(props)
  const chars = variant === 'digits' ? DIGIT_CHARS : SPAN_CHARS
  const [item, setItem] = useState(() => ({ items: makeSpan(START_SPAN, chars), reverse: false }))
  const [phase, setPhase] = useState<SpanPhase>({ name: 'cue' })
  const [input, setInput] = useState('')
  const round = useRef(0)
  const misses = useRef(0)
  const nextLen = useRef(START_SPAN)
  const recallAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  useEffect(() => {
    if (phase.name === 'recall') {
      recallAt.current = performance.now()
      return
    }
    const t = setTimeout(
      () => {
        if (phase.name === 'pause') {
          round.current++
          itemLevel.current = levelRef.current
          setItem({ items: makeSpan(nextLen.current, chars), reverse: variant === 'digitspan' && isReverse(round.current) })
          setInput('')
          setPhase({ name: 'cue' })
        } else if (phase.name === 'cue') setPhase({ name: 'show', i: 0, blank: true })
        else if (phase.blank) setPhase({ ...phase, blank: false })
        else if (phase.i + 1 < item.items.length) setPhase({ name: 'show', i: phase.i + 1, blank: true })
        else setPhase({ name: 'recall' })
      },
      phase.name === 'pause' ? phase.ms : phase.name === 'cue' ? 1200 : phase.blank ? 200 : stepMs(itemLevel.current),
    )
    return () => clearTimeout(t)
  }, [phase, item])

  function submit() {
    if (phase.name !== 'recall' || !normalizeSpan(input)) return
    const len = item.items.length
    const ok = normalizeSpan(input) === spanAnswer(item.items, item.reverse)
    onTrial({ correct: ok, rt: performance.now() - recallAt.current, level: itemLevel.current, kind: `${item.reverse ? 'rev' : 'fwd'}:${len}` })
    if (rr.count()) return
    misses.current = ok ? 0 : misses.current + 1
    if (variant === 'digits' && misses.current >= DIGITS_MAX_MISSES) rr.endRule()
    if (rr.done()) return
    nextLen.current = nextSpanLen(len, ok)
    setPhase({ name: 'pause', ok, ms: feedback ? 1600 : 400 })
  }

  const dir = item.reverse ? 'backwards' : 'in order'
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {phase.name === 'cue'
          ? item.reverse
            ? 'Next: type it BACKWARDS'
            : 'Next: type it in order'
          : phase.name === 'show'
            ? `${item.items.length} ${variant === 'digits' ? 'digits' : 'symbols'} · recall ${dir}`
            : phase.name === 'recall'
              ? `Type the sequence ${dir}`
              : ''}
      </div>
      {phase.name === 'recall' || phase.name === 'pause' ? (
        <form
          className="var-span"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            className="game__input var-span__input"
            aria-label={`Sequence, ${dir}`}
            inputMode={variant === 'digits' ? 'numeric' : 'text'}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            value={input}
            disabled={phase.name !== 'recall'}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="btn btn--ink" disabled={phase.name !== 'recall'}>
            Enter
          </button>
        </form>
      ) : (
        <div className={`game__stimulus${item.reverse ? ' var-span--rev' : ''}`}>
          {phase.name === 'cue' ? (item.reverse ? '⟵' : '⟶') : phase.blank ? '' : item.items[phase.i]}
        </div>
      )}
      <div
        className={`game__feedback ${phase.name === 'pause' && feedback ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`}
        aria-live="polite"
      >
        {phase.name === 'pause' &&
          feedback &&
          `${phase.ok ? 'Right' : 'Not quite'}: ${item.items.join(' ')}${item.reverse ? `, backwards ${spanAnswer(item.items, true).split('').join(' ')}` : ''}`}
      </div>
      <div className="game__keys">Type the sequence · Enter to submit · {variant === 'digits' ? 'one digit more when right, one fewer when wrong' : 'it grows when you get it right'}</div>
    </div>
  )
}

function WorkingMemoryGame({ level, feedback, onTrial, ...props }: GameProps) {
  const rr = useRounds(props)
  const [seq, setSeq] = useState(() => makeSequence(level))
  const [phase, setPhase] = useState<Phase>({ name: 'show', i: 0, blank: true })
  const [input, setInput] = useState<number[]>([])
  const recallAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  // Drives presentation and the post-answer pause; each phase owns exactly one timer.
  useEffect(() => {
    if (phase.name === 'recall') {
      recallAt.current = performance.now()
      return
    }
    const step = stepMs(itemLevel.current)
    const t = setTimeout(
      () => {
        if (phase.name === 'pause') {
          itemLevel.current = levelRef.current
          setSeq(makeSequence(levelRef.current))
          setInput([])
          setPhase({ name: 'show', i: 0, blank: true })
        } else if (phase.blank) setPhase({ ...phase, blank: false })
        else if (phase.i + 1 < seq.items.length) setPhase({ name: 'show', i: phase.i + 1, blank: true })
        else setPhase({ name: 'recall' })
      },
      phase.name === 'pause' ? phase.ms : phase.blank ? (phase.i === 0 ? 600 : 200) : step,
    )
    return () => clearTimeout(t)
  }, [phase, seq])

  function pick(x: number) {
    if (phase.name !== 'recall') return
    const next = [...input, x]
    setInput(next)
    if (next.length < seq.items.length) return
    const ok = isCorrect(seq, next)
    onTrial({ correct: ok, rt: performance.now() - recallAt.current, level: itemLevel.current })
    if (rr.count()) return
    setPhase({ name: 'pause', ok, ms: feedback ? 1400 : 300 })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (/^[1-9]$/.test(e.key)) pick(Number(e.key) - 1)
      else if (e.key === 'Backspace' && phase.name === 'recall') setInput((xs) => xs.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const showing = phase.name === 'show' && !phase.blank ? seq.items[phase.i] : undefined
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {phase.name === 'show' ? `Remember the order · ${seq.items.length} items` : phase.name === 'recall' ? 'Reproduce the sequence in order' : ''}
      </div>
      {phase.name === 'show' ? (
        seq.mode === 'grid' ? (
          <Grid on={showing} />
        ) : (
          <div className="game__stimulus">{showing === undefined ? '' : label(seq.mode, showing)}</div>
        )
      ) : (
        <>
          <div className="core-slots" aria-label={`${input.length} of ${seq.items.length} entered`}>
            {seq.items.map((_, i) => (
              <span key={i} className="core-slot">
                {input[i] === undefined ? '' : seq.mode === 'grid' ? input[i] + 1 : label(seq.mode, input[i])}
              </span>
            ))}
          </div>
          {seq.mode === 'grid' ? (
            <Grid onPick={pick} />
          ) : (
            <div className="game__choices core-pad">
              {Array.from({ length: 9 }, (_, i) => (
                <button key={i} type="button" className="btn game__choice" onClick={() => pick(i)} aria-label={`${label(seq.mode, i)} (key ${i + 1})`}>
                  {label(seq.mode, i)}
                  {seq.mode === 'symbols' && <span className="core-cellkey">{i + 1}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div
        className={`game__feedback ${phase.name === 'pause' && feedback ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`}
        aria-live="polite"
      >
        {phase.name === 'pause' &&
          feedback &&
          `${phase.ok ? 'Right' : 'Not quite'}: the sequence was ${seq.items.map((x) => (seq.mode === 'grid' ? x + 1 : label(seq.mode, x))).join(' ')}`}
      </div>
      <div className="game__keys">Keys 1–9 enter an item · Backspace removes the last</div>
    </div>
  )
}

export const workingMemory: GameDef = {
  id: 'working-memory',
  name: 'Sequence memory',
  skills: ['working-memory'],
  howTo: 'Watch the items appear one at a time, then enter them in the same order.',
  duration: 150,
  targetRt: 6000,
  Component: ((p: GameProps) => (p.variant === 'digitspan' || p.variant === 'digits' ? <SpanGame {...p} /> : <WorkingMemoryGame {...p} />)) satisfies ComponentType<GameProps>,
  details: spanDetails,
}
