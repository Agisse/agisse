import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './hirevue.css'

type Rand = () => number
const rnd = (n: number, rand: Rand) => Math.floor(rand() * n)

/** Colours come in pairs: c ^ 1 is the near shade of c. */
export const COLOURS = ['#1d5bb8', '#3d78cf', '#0b7a3b', '#2f9a5a', '#b3261e', '#d04a3f', '#a84b00', '#c9701f']
const SHAPES = ['8,6 18,6 18,24 32,24 32,34 8,34', '10,4 32,12 15,19 15,36 10,36', '5,20 19,6 19,14 35,14 35,26 19,26 19,34', '6,34 6,23 15,23 15,13 25,13 25,5 34,5 34,34']
const DOTS = [
  [13, 12],
  [27, 12],
  [27, 28],
  [13, 28],
]
/** Every shape is asymmetric, so each quarter turn is visible. */
export type Figure = { shape: number; colour: number; rot: number; dot: number }
export type Diff = 'shape' | 'colour' | 'rot' | 'dot'
export const figKey = (f: Figure) => `${f.shape}.${f.colour}.${f.rot}.${f.dot}`

const randomFigure = (rand: Rand): Figure => ({ shape: rnd(4, rand), colour: rnd(8, rand), rot: rnd(4, rand), dot: rnd(4, rand) })

/** Every figure that differs from f in one attribute; `subtle` keeps only the hard ones (near shade, quarter turn, neighbouring dot). */
export function variantsOf(f: Figure, subtle: boolean): { fig: Figure; diff: Diff }[] {
  const out: { fig: Figure; diff: Diff }[] = []
  for (let s = 0; s < 4; s++) if (s !== f.shape && !subtle) out.push({ fig: { ...f, shape: s }, diff: 'shape' })
  for (let c = 0; c < 8; c++) if (c !== f.colour && (!subtle || c === (f.colour ^ 1))) out.push({ fig: { ...f, colour: c }, diff: 'colour' })
  for (let r = 0; r < 4; r++) if (r !== f.rot && (!subtle || r !== (f.rot + 2) % 4)) out.push({ fig: { ...f, rot: r }, diff: 'rot' })
  for (let d = 0; d < 4; d++) if (d !== f.dot && (!subtle || d !== (f.dot + 2) % 4)) out.push({ fig: { ...f, dot: d }, diff: 'dot' })
  return out
}

function shuffle<T>(xs: T[], rand: Rand) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = rnd(i + 1, rand)
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
  return xs
}

export type UniqueItem = { size: number; figs: Figure[]; odd: number; diff: Diff }
/** Singularity: grid 3×3 → 6×6, one figure differs; from level 5 the difference is subtle. */
export function makeUnique(level: number, rand: Rand = Math.random): UniqueItem {
  const size = level <= 2 ? 3 : level <= 5 ? 4 : level <= 8 ? 5 : 6
  const base = randomFigure(rand)
  const vs = variantsOf(base, level >= 5)
  const v = vs[rnd(vs.length, rand)]
  const odd = rnd(size * size, rand)
  return { size, figs: Array.from({ length: size * size }, (_, i) => (i === odd ? v.fig : base)), odd, diff: v.diff }
}

export type IdenticalItem = { size: number; figs: Figure[]; same: number[] }
/** Shapedance: 2–5 identical figures among near-copies that all differ from each other; grid 3×3 → 4×4 from level 5, subtle-only from level 8. */
export function makeIdentical(level: number, rand: Rand = Math.random): IdenticalItem {
  const size = level <= 4 ? 3 : 4
  const m = size === 3 ? 2 + rnd(2, rand) : 3 + rnd(3, rand)
  const base = randomFigure(rand)
  const subtle = shuffle(variantsOf(base, true), rand)
  const rest = shuffle(variantsOf(base, false).filter((v) => !subtle.some((s) => figKey(s.fig) === figKey(v.fig))), rand)
  // Subtle variants first; fill from the rest only when the grid needs more than they offer.
  const pool = level >= 8 ? [...subtle, ...rest] : shuffle([...subtle, ...rest], rand)
  const figs = shuffle([...Array(m).fill(base), ...pool.slice(0, size * size - m).map((v) => v.fig)], rand)
  const same = figs.flatMap((f, i) => (figKey(f) === figKey(base) ? [i] : []))
  return { size, figs, same }
}

/** Hits, misses and false alarms of a Shapedance selection; correct needs all hits and nothing else. */
export function judgeIdentical(item: IdenticalItem, picked: number[]) {
  const hits = picked.filter((i) => item.same.includes(i)).length
  const falseAlarms = picked.length - hits
  return { correct: hits === item.same.length && falseAlarms === 0, kind: `id:${hits}/${item.same.length}/${falseAlarms}` }
}

export function shapeDetails(trials: Trial[]) {
  const rate = (d: Diff) => {
    const ts = trials.filter((t) => t.kind === d)
    return ts.length ? Math.round((ts.filter((t) => t.correct).length / ts.length) * 1000) / 1000 : 0
  }
  const ids = trials.map((t) => (t.kind ?? '').match(/^id:(\d+)\/(\d+)\/(\d+)$/)).filter((m) => m) as RegExpMatchArray[]
  return {
    colourRate: rate('colour'),
    rotationRate: rate('rot'),
    detailRate: rate('dot'),
    missed: ids.reduce((s, m) => s + Number(m[2]) - Number(m[1]), 0),
    falseAlarms: ids.reduce((s, m) => s + Number(m[3]), 0),
  }
}

function FigureSvg({ f }: { f: Figure }) {
  return (
    <svg viewBox="0 0 40 40" className="hv-fig" aria-hidden="true">
      <polygon points={SHAPES[f.shape]} fill={COLOURS[f.colour]} transform={`rotate(${f.rot * 90} 20 20)`} />
      <circle cx={DOTS[f.dot][0]} cy={DOTS[f.dot][1]} r="3.2" />
    </svg>
  )
}

const DIFF_TEXT: Record<Diff, string> = { shape: 'its shape', colour: 'its colour', rot: 'its rotation', dot: 'the dot' }

function ShapeMatchGame({ level, feedback, onTrial, variant, rounds, onDone }: GameProps) {
  const identical = variant === 'identical'
  const make = (l: number) => (identical ? makeIdentical(l) : makeUnique(l))
  const [item, setItem] = useState<UniqueItem | IdenticalItem>(() => make(level))
  const [picked, setPicked] = useState<number[]>([])
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
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
        setItem(make(levelRef.current))
      },
      feedback ? 1400 : 250,
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, feedback])

  function record(correct: boolean, kind: string, text: string) {
    onTrial({ correct, rt: performance.now() - shownAt.current, level: itemLevel.current, kind })
    if (rounds && ++played.current >= rounds) onDone?.()
    setFb({ ok: correct, text })
  }
  function click(i: number) {
    if (fb) return
    if ('odd' in item) return record(i === item.odd, item.diff, `the odd one out differs in ${DIFF_TEXT[item.diff]}`)
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))
  }
  function submit() {
    if (fb || 'odd' in item || picked.length < 2) return
    const { correct, kind } = judgeIdentical(item, picked)
    record(correct, kind, `${item.same.length} figures are identical; they are outlined`)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'Enter' && identical) {
        e.preventDefault()
        return submit()
      }
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -item.size, ArrowDown: item.size }[e.key]
      if (!d) return
      e.preventDefault()
      const cells = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      const i = cells.indexOf(document.activeElement as HTMLButtonElement)
      cells[i < 0 ? 0 : Math.min(cells.length - 1, Math.max(0, i + d))]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const reveal = !!fb && feedback
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {identical ? `Select every figure that is exactly identical to another (${picked.length} selected)` : 'Click the one figure that is different'}
      </div>
      <div ref={gridRef} className="hv-figs" style={{ gridTemplateColumns: `repeat(${item.size}, auto)` }}>
        {item.figs.map((f, i) => (
          <button
            key={i}
            type="button"
            className="hv-cell hv-figcell"
            aria-pressed={identical ? picked.includes(i) : undefined}
            aria-label={`Figure ${i + 1}, row ${Math.floor(i / item.size) + 1}, column ${(i % item.size) + 1}`}
            data-answer={reveal && ('odd' in item ? i === item.odd : item.same.includes(i)) ? 'true' : undefined}
            disabled={!!fb}
            onClick={() => click(i)}
          >
            <FigureSvg f={f} />
          </button>
        ))}
      </div>
      {identical && (
        <button type="button" className="btn btn--ink" disabled={!!fb || picked.length < 2} onClick={submit}>
          Submit
        </button>
      )}
      <div className={`game__feedback ${reveal ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {reveal && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
      </div>
      <div className="game__keys">{identical ? 'Arrows move · Space selects · Enter submits' : 'Arrows move · Space or Enter picks'}</div>
    </div>
  )
}

export const shapeMatch: GameDef = {
  id: 'shape-match',
  name: 'Shape match',
  skills: ['visual-scanning', 'attention'],
  howTo: 'Spot the figure that differs from the rest (Singularity), or select every figure that is exactly identical (Shapedance); watch colour, rotation and the dot.',
  duration: 180,
  targetRt: 4000,
  Component: ShapeMatchGame satisfies ComponentType<GameProps>,
  details: shapeDetails,
}
