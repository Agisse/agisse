import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './arctic.css'
import { moveChoiceFocus, shuffle } from './SequenceReasoning'

type Rand = () => number
/** rot is in 45° steps (0–7); pos is a cell of a 3×3 grid (0–8, row by row). */
export type Frame = { shape: number; colour: number; size: number; rot: number; pos: number }
export type Attr = keyof Frame
export const ATTRS: Attr[] = ['shape', 'colour', 'size', 'rot', 'pos']
export const OPTIONS: Record<Attr, number> = { shape: 4, colour: 4, size: 4, rot: 8, pos: 9 }
/** The outer ring of the 3×3 grid, clockwise from the top-left; moving positions step along it. */
const RING = [0, 1, 2, 5, 8, 7, 6, 3]
export type OrderItem = { frames: Frame[]; answer: Frame; changing: Attr[]; choices: Frame[]; answerIdx: number; explain: string }

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const other = (n: number, not: number, rand: Rand) => (not + int(1, n - 1, rand)) % n
export const sameFrame = (a: Frame, b: Frame) => ATTRS.every((k) => a[k] === b[k])
/** Changing attributes: 1 at levels 1–2, 2 at 3–4 … all 5 at 9–10. */
export const changingCount = (level: number) => Math.min(5, Math.max(1, Math.ceil(level / 2)))

/**
 * Three example frames and the fourth. Shape and colour alternate (A B A → B); size steps ±1 through 4 sizes;
 * rotation turns ±45° or ±90°; position steps one cell round the grid's ring. Unchanging attributes stay put.
 * `choices` (the Patterns variant) holds the answer and 4 distractors that each break one attribute.
 */
export function makeOrderItem(level: number, rand: Rand = Math.random): OrderItem {
  const changing = shuffle(ATTRS, rand).slice(0, changingCount(level))
  const ch = (a: Attr) => changing.includes(a)
  const [shape0, colour0] = [int(0, 3, rand), int(0, 3, rand)]
  const [shape1, colour1] = [other(4, shape0, rand), other(4, colour0, rand)]
  const sizeStep = rand() < 0.5 ? 1 : -1
  const size0 = ch('size') ? (sizeStep > 0 ? 0 : 3) : int(0, 3, rand)
  const rotStep = (rand() < 0.5 ? 1 : 2) * (rand() < 0.5 ? 1 : -1)
  const rot0 = int(0, 7, rand)
  const posStep = rand() < 0.5 ? 1 : -1
  // Start on an edge's middle cell so the three frames turn a corner; from a corner they would run straight along one
  // edge, and "carry on in reading order" would fit as well as the ring.
  const ring0 = int(0, 3, rand) * 2 + 1
  const pos0 = ch('pos') ? RING[ring0]! : int(0, 8, rand)
  const at = (i: number): Frame => ({
    shape: ch('shape') && i % 2 ? shape1 : shape0,
    colour: ch('colour') && i % 2 ? colour1 : colour0,
    size: ch('size') ? size0 + i * sizeStep : size0,
    rot: ch('rot') ? (((rot0 + i * rotStep) % 8) + 8) % 8 : rot0,
    pos: ch('pos') ? RING[(((ring0 + i * posStep) % 8) + 8) % 8]! : pos0,
  })
  const answer = at(3)
  const wrong: Frame[] = []
  for (const a of shuffle(ATTRS, rand).sort((x, y) => Number(ch(y)) - Number(ch(x)))) {
    // A changing attribute's most tempting slip is "no change" (frame 3's value); otherwise any other value.
    const v = ch(a) && at(2)[a] !== answer[a] && rand() < 0.6 ? at(2)[a] : other(OPTIONS[a], answer[a], rand)
    const f = { ...answer, [a]: v }
    if (!wrong.some((w) => sameFrame(w, f))) wrong.push(f)
    if (wrong.length === 4) break
  }
  const choices = shuffle([answer, ...wrong], rand)
  const parts = changing.map((a) =>
    a === 'shape' ? 'shape alternates' : a === 'colour' ? 'colour alternates' : a === 'size' ? `size ${sizeStep > 0 ? 'grows' : 'shrinks'}` : a === 'rot' ? `turns ${Math.abs(rotStep) * 45}° ${rotStep > 0 ? 'clockwise' : 'anticlockwise'}` : `moves one cell ${posStep > 0 ? 'clockwise' : 'anticlockwise'} round the edge`,
  )
  return { frames: [0, 1, 2].map(at), answer, changing, choices, answerIdx: choices.indexOf(answer), explain: `Each step the ${parts.join(', ')}` }
}

export function orderDetails(trials: Trial[]) {
  const t = trials.filter((x) => x.kind?.startsWith('order:'))
  const acc = (xs: Trial[]) => (xs.length ? Math.round((xs.filter((x) => x.correct).length / xs.length) * 1000) / 1000 : 0)
  return { accuracy: acc(t), multiRuleAccuracy: acc(t.filter((x) => Number(x.kind!.slice(6)) >= 3)) }
}

const SHAPES = ['circle', 'square', 'triangle', 'star'] as const
const COLOURS = [
  ['ink', 'var(--ink)'],
  ['blue', '#1d5bb8'],
  ['orange', '#a84b00'],
  ['green', 'var(--green)'],
] as const
const SIZES = ['small', 'medium', 'large', 'extra large'] as const
const describe = (f: Frame) => `${SIZES[f.size]} ${COLOURS[f.colour]![0]} ${SHAPES[f.shape]}, turned ${f.rot * 45}°, cell ${f.pos + 1}`

/** One frame: a 3×3 field with the shape in its cell; the tick on top makes rotation readable for every shape. */
function FrameView({ f, mini }: { f: Frame; mini?: boolean }) {
  const cx = 20 + (f.pos % 3) * 40
  const cy = 20 + Math.floor(f.pos / 3) * 40
  const r = 7 + f.size * 3.5
  const s = SHAPES[f.shape]
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 120 120" className={mini ? 'arc-frame arc-frame--mini' : 'arc-frame'} aria-hidden="true">
      <rect x="1" y="1" width="118" height="118" className="arc-frame__box" />
      <g transform={`rotate(${f.rot * 45} ${cx} ${cy})`} fill={COLOURS[f.colour]![1]}>
        {s === 'circle' && <circle cx={cx} cy={cy} r={r} />}
        {s === 'square' && <rect x={cx - r * 0.85} y={cy - r * 0.85} width={r * 1.7} height={r * 1.7} />}
        {s === 'triangle' && <polygon points={`${cx},${cy - r} ${cx + r * 0.9},${cy + r * 0.75} ${cx - r * 0.9},${cy + r * 0.75}`} />}
        {s === 'star' && <polygon points={star} />}
        <rect x={cx - 1.5} y={cy - r - 6} width="3" height="5" />
      </g>
    </svg>
  )
}

function OrderGame({ level, feedback, onTrial, variant, rounds, onDone }: GameProps) {
  const patterns = variant === 'patterns'
  const [item, setItem] = useState(() => makeOrderItem(level))
  const [built, setBuilt] = useState<Frame>(() => item.frames[2]!)
  const [fb, setFb] = useState<{ ok: boolean } | null>(null)
  const choicesRef = useRef<HTMLDivElement>(null)
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
        const next = makeOrderItem(levelRef.current)
        setFb(null)
        setItem(next)
        setBuilt(next.frames[2]!)
      },
      feedback ? 2000 : 300,
    )
    return () => clearTimeout(t)
  }, [fb, feedback])

  function answer(f: Frame) {
    if (fb) return
    const ok = sameFrame(f, item.answer)
    onTrial({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: `order:${item.changing.length}` })
    setFb({ ok })
    if (rounds && ++done.current >= rounds) onDone?.()
  }

  useEffect(() => {
    if (!patterns) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const n = Number(e.key)
      if (n >= 1 && n <= 5) answer(item.choices[n - 1]!)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        moveChoiceFocus(choicesRef.current, e.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const label: Record<Attr, (v: number) => string> = {
    shape: (v) => SHAPES[v]!,
    colour: (v) => COLOURS[v]![0],
    size: (v) => SIZES[v]!,
    rot: (v) => `${v * 45}°`,
    pos: (v) => `cell ${v + 1}`,
  }
  const NAMES: Record<Attr, string> = { shape: 'Shape', colour: 'Colour', size: 'Size', rot: 'Turn', pos: 'Position' }
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {patterns ? 'Which square comes next?' : 'Build the next frame.'}
      </div>
      <div className="rsn-frames" role="img" aria-label={`Frames: ${item.frames.map(describe).join('; ')}; then ?`}>
        {item.frames.map((f, i) => (
          <FrameView key={i} f={f} />
        ))}
        {patterns ? <span className="rsn-q">?</span> : <FrameView f={built} />}
      </div>
      {patterns ? (
        <div className="game__choices" ref={choicesRef}>
          {item.choices.map((c, i) => (
            <button
              key={i}
              type="button"
              className="btn game__choice rsn-choice"
              data-answer={fb && feedback && i === item.answerIdx ? 'true' : undefined}
              aria-label={`${i + 1}: ${describe(c)}`}
              disabled={!!fb}
              onClick={() => answer(c)}
            >
              <span className="rsn-key">{i + 1}</span>
              <FrameView f={c} mini />
            </button>
          ))}
        </div>
      ) : (
        <form
          className="arc-builder"
          onSubmit={(e) => {
            e.preventDefault()
            answer(built)
          }}
        >
          {ATTRS.map((a) => (
            <fieldset key={a} className="arc-builder__group" data-attr={a} disabled={!!fb}>
              <legend>{NAMES[a]}</legend>
              {Array.from({ length: OPTIONS[a] }, (_, v) => (
                <label key={v} className="arc-opt" title={label[a](v)}>
                  <input type="radio" name={a} checked={built[a] === v} onChange={() => setBuilt({ ...built, [a]: v })} aria-label={label[a](v)} />
                  <FrameView f={a === 'pos' ? { ...built, size: 0, pos: v } : { ...built, pos: 4, [a]: v }} mini />
                </label>
              ))}
            </fieldset>
          ))}
          <button type="submit" className="btn btn--primary" disabled={!!fb}>
            Submit
          </button>
        </form>
      )}
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${item.explain}`}
      </div>
      <div className="game__keys">{patterns ? '1–5 to answer · ←/→ then Enter' : 'Tab between groups · arrow keys pick · Enter submits'}</div>
    </div>
  )
}

export const order: GameDef = {
  id: 'order',
  name: 'Order',
  skills: ['logical-reasoning'],
  howTo: 'Shape, colour, size, turn and position each follow a rule across the frames; work out the next frame.',
  duration: 600,
  targetRt: 25000,
  Component: OrderGame satisfies ComponentType<GameProps>,
  details: orderDetails,
}
