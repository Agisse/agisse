import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps } from '../engine/types'
import './games.css'
import './reasoning.css'

type Rand = () => number
export type Shape = { rot: number; dots: number; filled: boolean }
export type SeqItem =
  | { type: 'number'; terms: number[]; choices: number[]; answer: number; explain: string }
  | { type: 'shape'; frames: Shape[]; choices: Shape[]; answer: number; explain: string }

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
export function shuffle<T>(xs: T[], rand: Rand): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Three distinct wrong answers, the plausible ones (a rule applied off by one step) first. */
function withDistractors(ans: number, near: number[], rand: Rand) {
  const wrong = new Set(shuffle(near, rand).filter((n) => n !== ans && n >= 0))
  for (let k = 1; wrong.size < 3; k++) wrong.add(ans + k)
  const choices = shuffle([ans, ...[...wrong].slice(0, 3)], rand)
  return { choices, answer: choices.indexOf(ans) }
}

/** Rules unlock with level: +d from 1, growing differences from 2, ×r from 4, two interleaved sequences from 6, alternating +a/×2 from 8. */
export function makeNumberItem(level: number, rand: Rand = Math.random): SeqItem {
  const rules = ['arith', ...(level >= 2 ? ['growing'] : []), ...(level >= 4 ? ['geo'] : []), ...(level >= 6 ? ['interleave'] : []), ...(level >= 8 ? ['altop'] : [])]
  const pool = rules.slice(-3)
  const rule = pool[Math.floor(rand() * pool.length)]
  const len = level < 5 ? 5 : 6
  const t: number[] = []
  let ans: number
  let near: number[]
  let explain: string
  if (rule === 'growing') {
    const d = int(1, 4, rand)
    const s = int(1, level >= 5 ? 3 : 2, rand)
    t.push(int(1, 10, rand))
    for (let i = 0; i < len - 1; i++) t.push(t[i]! + d + i * s)
    const nd = d + (len - 1) * s
    const last = t[len - 1]!
    ans = last + nd
    near = [last + nd - s, ans + s, ans - 1, ans + 1]
    explain = `Differences +${t.slice(1).map((x, i) => x - t[i]!).join(', +')} → next +${nd} = ${ans}`
  } else if (rule === 'geo') {
    const a = int(1, 5, rand)
    const r = int(2, 3, rand)
    for (let i = 0; i < len; i++) t.push(a * r ** i)
    const last = t[len - 1]!
    ans = last * r
    near = [last + (last - t[len - 2]!), last * (r + 1), ans + r, ans - a]
    explain = `×${r} each step → ${last} × ${r} = ${ans}`
  } else if (rule === 'interleave') {
    const [a, d1, b, d2] = [int(1, 20, rand), int(2, 6, rand), int(1, 20, rand), int(2, 9, rand)]
    for (let i = 0; i < 7; i++) t.push(i % 2 ? b + ((i - 1) / 2) * d2 : a + (i / 2) * d1)
    ans = b + 3 * d2
    near = [a + 4 * d1, ans + d2, ans + d1, ans + 1]
    explain = `Two sequences take turns; every other term +${d2} → ${ans}`
  } else if (rule === 'altop') {
    const a = int(1, 5, rand)
    t.push(int(1, 6, rand))
    for (let i = 0; i < 5; i++) t.push(i % 2 ? t[i]! * 2 : t[i]! + a)
    const last = t[5]!
    ans = last * 2
    near = [last + a, ans + a, last * 3, ans - 2]
    explain = `Alternates +${a}, ×2 → ${last} × 2 = ${ans}`
  } else {
    const d = int(2, 3 + level, rand)
    t.push(int(1, 20, rand))
    for (let i = 1; i < len; i++) t.push(t[0]! + i * d)
    ans = t[len - 1]! + d
    near = [ans + d, ans + 1, ans - 1, ans + 2]
    explain = `+${d} each step → ${ans}`
  }
  return { type: 'number', terms: t, ...withDistractors(ans, near, rand), explain }
}

const shapeKey = (s: Shape) => `${s.rot}|${s.dots}|${s.filled}`
const mod360 = (x: number) => ((x % 360) + 360) % 360

/** One changing attribute at level 4–5, two at 6–7, three from 8. Distractors break exactly one attribute. */
export function makeShapeItem(level: number, rand: Rand = Math.random): SeqItem {
  const attrs = shuffle(['rot', 'dots', 'fill'], rand).slice(0, level >= 8 ? 3 : level >= 6 ? 2 : 1)
  const rotStep = attrs.includes('rot') ? (rand() < 0.5 ? 45 : 90) * (rand() < 0.5 ? 1 : -1) : 0
  const dotStep = attrs.includes('dots') ? 1 : 0
  const start: Shape = { rot: int(0, 7, rand) * 45, dots: dotStep ? 1 : int(1, 3, rand), filled: rand() < 0.5 }
  const at = (i: number): Shape => ({
    rot: mod360(start.rot + i * rotStep),
    dots: start.dots + i * dotStep,
    filled: attrs.includes('fill') ? (i % 2 === 0) === start.filled : start.filled,
  })
  const ans = at(4)
  const step = rotStep || 90
  const variants: Shape[] = [
    { ...ans, rot: mod360(ans.rot + step) },
    { ...ans, rot: mod360(ans.rot - step) },
    { ...ans, dots: ans.dots + 1 },
    ...(ans.dots > 1 ? [{ ...ans, dots: ans.dots - 1 }] : []),
    { ...ans, filled: !ans.filled },
  ]
  const seen = new Set([shapeKey(ans)])
  const wrong = shuffle(variants, rand).filter((v) => !seen.has(shapeKey(v)) && seen.add(shapeKey(v))).slice(0, 3)
  const choices = shuffle([ans, ...wrong], rand)
  const parts = [
    ...(rotStep ? [`turns ${Math.abs(rotStep)}° ${rotStep > 0 ? 'clockwise' : 'anticlockwise'}`] : []),
    ...(dotStep ? ['gains a dot'] : []),
    ...(attrs.includes('fill') ? ['fill alternates'] : []),
  ]
  return { type: 'shape', frames: [0, 1, 2, 3].map(at), choices, answer: choices.indexOf(ans), explain: `Each step it ${parts.join(', ')}` }
}

export const makeSeqItem = (level: number, rand: Rand = Math.random) => (level >= 4 && rand() < 0.4 ? makeShapeItem(level, rand) : makeNumberItem(level, rand))

const describe = (s: Shape) => `pointer at ${s.rot}°, ${s.dots} dot${s.dots > 1 ? 's' : ''}, ${s.filled ? 'filled' : 'outline'}`

function Glyph({ s }: { s: Shape }) {
  return (
    <svg viewBox="0 0 64 64" className="rsn-glyph" aria-hidden="true">
      <polygon points="32,8 45,38 19,38" transform={`rotate(${s.rot} 32 26)`} fill={s.filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      {Array.from({ length: s.dots }, (_, i) => (
        <circle key={i} cx={32 + (i - (s.dots - 1) / 2) * 9} cy={56} r={3} fill="currentColor" />
      ))}
    </svg>
  )
}

/** ←/→ walk focus across the choice buttons; Enter then presses the focused one natively. */
export function moveChoiceFocus(root: HTMLElement | null, dir: number) {
  const btns = [...(root?.querySelectorAll<HTMLButtonElement>('.game__choice') ?? [])]
  if (!btns.length) return
  const i = btns.indexOf(document.activeElement as HTMLButtonElement)
  btns[i < 0 ? 0 : (i + dir + btns.length) % btns.length]!.focus()
}

function SequenceReasoningGame({ level, feedback, onTrial }: GameProps) {
  const [item, setItem] = useState(() => makeSeqItem(level))
  const [fb, setFb] = useState<{ ok: boolean; ms: number } | null>(null)
  const choicesRef = useRef<HTMLDivElement>(null)
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
    const t = setTimeout(() => {
      setFb(null)
      setItem(makeSeqItem(levelRef.current))
    }, fb.ms)
    return () => clearTimeout(t)
  }, [fb])

  function answer(i: number) {
    if (fb) return
    const correct = i === item.answer
    onTrial({ correct, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: item.type })
    setFb({ ok: correct, ms: feedback ? 1200 : 0 })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) answer(n - 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        moveChoiceFocus(choicesRef.current, e.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        What comes next?
      </div>
      {item.type === 'number' ? (
        <div className="game__stimulus rsn-terms">{item.terms.join(', ')}, ?</div>
      ) : (
        <div className="rsn-frames" role="img" aria-label={`Sequence: ${item.frames.map(describe).join('; ')}; then ?`}>
          {item.frames.map((s, i) => (
            <Glyph key={i} s={s} />
          ))}
          <span className="rsn-q">?</span>
        </div>
      )}
      <div className="game__choices" ref={choicesRef}>
        {item.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            className="btn game__choice rsn-choice"
            data-answer={fb && feedback && i === item.answer ? 'true' : undefined}
            aria-label={typeof c === 'number' ? `${i + 1}: ${c}` : `${i + 1}: ${describe(c)}`}
            disabled={!!fb}
            onClick={() => answer(i)}
          >
            <span className="rsn-key">{i + 1}</span>
            {typeof c === 'number' ? c : <Glyph s={c} />}
          </button>
        ))}
      </div>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${item.explain}`}
      </div>
      <div className="game__keys">1–4 to answer · ←/→ then Enter</div>
    </div>
  )
}

export const sequenceReasoning: GameDef = {
  id: 'sequence-reasoning',
  name: 'Sequence reasoning',
  skills: ['logical-reasoning'],
  howTo: 'Find the rule behind each sequence of numbers or shapes and pick what comes next.',
  duration: 180,
  targetRt: 9000,
  Component: SequenceReasoningGame satisfies ComponentType<GameProps>,
}
