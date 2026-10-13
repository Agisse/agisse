import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type RefObject } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './hirevue.css'

type Rand = () => number
const rnd = (n: number, rand: Rand) => Math.floor(rand() * n)

// ---------- Puzzle (HireVue): remember an abstract picture, then swap its shuffled pieces back ----------

export const ART_SIZE = 300
export const PREVIEW_MS = 5000
const ART_COLOURS = ['#0b7a3b', '#f7e232', '#b3261e', '#1d5bb8', '#a84b00', '#141414', '#7fc79a', '#e3dcef', '#d8ecec']
export type Shape = { kind: 'circle' | 'rect' | 'tri' | 'band'; x: number; y: number; s: number; rot: number; fill: string }
export type Art = { bg: string; shapes: Shape[] }
/** order[slot] = the piece shown in that slot; solved when order[i] === i. */
export type PuzzleItem = { n: number; art: Art; order: number[] }

/** The colour ArtSvg paints at (px, py): the last shape covering it, else the background. */
export function colourAt(art: Art, px: number, py: number) {
  let c = art.bg
  for (const s of art.shapes) {
    const a = (s.rot * Math.PI) / 180
    const dx = px - s.x
    const dy = py - s.y
    // Into the shape's own frame (SVG rotate turns clockwise on screen).
    const x = dx * Math.cos(a) + dy * Math.sin(a)
    const y = -dx * Math.sin(a) + dy * Math.cos(a)
    const h = s.s / 2
    const inside =
      s.kind === 'circle' ? dx * dx + dy * dy <= h * h : s.kind === 'rect' ? Math.abs(x) <= h && Math.abs(y) <= s.s / 3 : s.kind === 'band' ? Math.abs(x) <= s.s && Math.abs(y) <= 8 : y >= -h && y <= h && Math.abs(x) <= (y + h) / 2
    if (inside) c = s.fill
  }
  return c
}

/** True when no two pieces look alike, sampled on a 10×10 grid each; twin pieces (two blank corners) would make a rebuilt picture count as wrong. */
export function piecesDistinct(art: Art, n: number) {
  const piece = ART_SIZE / n
  const sigs = new Set<string>()
  for (let i = 0; i < n * n; i++) {
    const [ox, oy] = [(i % n) * piece, Math.floor(i / n) * piece]
    let sig = ''
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) sig += colourAt(art, ox + ((x + 0.5) * piece) / 10, oy + ((y + 0.5) * piece) / 10) + ';'
    sigs.add(sig)
  }
  return sigs.size === n * n
}

/** 6 → 11 shapes; 3×3 pieces up to level 5, then 4×4. Never starts solved; no two pieces alike. */
export function makeArtPuzzle(level: number, rand: Rand = Math.random): PuzzleItem {
  const kinds = ['circle', 'rect', 'tri', 'band'] as const
  const n = level <= 5 ? 3 : 4
  const draw = () =>
    Array.from({ length: 5 + Math.ceil(level / 2) }, (): Shape => ({
      kind: kinds[rnd(4, rand)],
      x: rnd(ART_SIZE, rand),
      y: rnd(ART_SIZE, rand),
      s: 40 + rnd(110, rand),
      rot: rnd(180, rand),
      fill: ART_COLOURS[rnd(ART_COLOURS.length, rand)],
    }))
  const bg = rand() < 0.5 ? '#f4f4f2' : '#fbf3b0'
  let shapes = draw()
  for (let k = 0; k < 200 && !piecesDistinct({ bg, shapes }, n); k++) shapes = draw()
  const order = Array.from({ length: n * n }, (_, i) => i)
  do {
    for (let i = order.length - 1; i > 0; i--) {
      const j = rnd(i + 1, rand)
      ;[order[i], order[j]] = [order[j], order[i]]
    }
  } while (order.every((p, i) => p === i))
  return { n, art: { bg, shapes }, order }
}

/** Fewest swaps that sort a permutation: length minus its number of cycles. */
export function minSwaps(order: number[]) {
  const seen = new Set<number>()
  let cycles = 0
  for (let i = 0; i < order.length; i++) {
    if (seen.has(i)) continue
    cycles++
    for (let j = i; !seen.has(j); j = order[j]) seen.add(j)
  }
  return order.length - cycles
}

/** Right when rebuilt within two swaps of the minimum. */
export const puzzleOk = (swaps: number, min: number) => swaps <= min + 2

function ArtSvg({ art, view }: { art: Art; view?: [number, number, number] }) {
  const [x, y, w] = view ?? [0, 0, ART_SIZE]
  return (
    <svg viewBox={`${x} ${y} ${w} ${w}`} className="hv-art" aria-hidden="true">
      <rect width={ART_SIZE} height={ART_SIZE} fill={art.bg} />
      {art.shapes.map((s, i) => {
        const t = `rotate(${s.rot} ${s.x} ${s.y})`
        if (s.kind === 'circle') return <circle key={i} cx={s.x} cy={s.y} r={s.s / 2} fill={s.fill} />
        if (s.kind === 'rect') return <rect key={i} x={s.x - s.s / 2} y={s.y - s.s / 3} width={s.s} height={(s.s * 2) / 3} fill={s.fill} transform={t} />
        if (s.kind === 'band') return <rect key={i} x={s.x - s.s} y={s.y - 8} width={s.s * 2} height={16} fill={s.fill} transform={t} />
        return <polygon key={i} points={`${s.x},${s.y - s.s / 2} ${s.x + s.s / 2},${s.y + s.s / 2} ${s.x - s.s / 2},${s.y + s.s / 2}`} fill={s.fill} transform={t} />
      })}
    </svg>
  )
}

// ---------- Resemble (Criteria): copy a tile pattern, sometimes turned ----------

export type Turn = 0 | 1 | 2 | 3
/** shown: the pattern on screen; answer: what the player must build; 0 = empty, 1–4 colours. */
export type ResembleItem = { size: number; colours: number; shown: number[]; answer: number[]; turn: Turn; mode: 'none' | 'shown-turned' | 'build-turned' }

/** Turns a row-major square grid clockwise by quarter turns. */
export function rotate(grid: number[], size: number, q: number): number[] {
  let g = grid
  for (let k = 0; k < ((q % 4) + 4) % 4; k++) g = g.map((_, i) => g[(size - 1 - (i % size)) * size + Math.floor(i / size)])
  return g
}

/** 3×3 → 4×4, colours 2 → 4. From level 4 the pattern is shown turned (build it upright); from 7 it may instead be upright and have to be built turned. */
export function makeResemble(level: number, rand: Rand = Math.random): ResembleItem {
  const size = level <= 4 ? 3 : 4
  const colours = level <= 2 ? 2 : level <= 6 ? 3 : 4
  let base: number[]
  do base = Array.from({ length: size * size }, () => (rand() < 0.3 ? 0 : 1 + rnd(colours, rand)))
  while (sameGrid(rotate(base, size, 1), base) || sameGrid(rotate(base, size, 2), base)) // every turn must change something
  if (level < 4) return { size, colours, shown: base, answer: base, turn: 0, mode: 'none' }
  const turn = (1 + rnd(3, rand)) as Turn
  if (level >= 7 && rand() < 0.5) return { size, colours, shown: base, answer: rotate(base, size, turn), turn, mode: 'build-turned' }
  return { size, colours, shown: rotate(base, size, turn), answer: base, turn, mode: 'shown-turned' }
}

export const sameGrid = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

const TURN_TEXT: Record<Turn, string> = { 0: '', 1: '90° clockwise', 2: '180°', 3: '90° anticlockwise' }
export const resembleKind = (it: ResembleItem) => (it.mode === 'none' ? 'upright' : it.mode)

export function imagePuzzleDetails(trials: Trial[]) {
  const swaps = trials.map((t) => (t.kind ?? '').match(/^swaps:(\d+)\/(\d+)$/)).filter((m) => m) as RegExpMatchArray[]
  const turned = trials.filter((t) => t.kind === 'shown-turned' || t.kind === 'build-turned')
  const upright = trials.filter((t) => t.kind === 'upright')
  const rate = (ts: Trial[]) => (ts.length ? Math.round((ts.filter((t) => t.correct).length / ts.length) * 1000) / 1000 : 0)
  const extra = swaps.map((m) => Number(m[1]) - Number(m[2]))
  return {
    meanExtraSwaps: extra.length ? Math.round((extra.reduce((a, b) => a + b, 0) / extra.length) * 10) / 10 : 0,
    uprightRate: rate(upright),
    turnedRate: rate(turned),
  }
}

// ---------- Component ----------

type Fb = { ok: boolean; text: string } | null

function useRound(level: number, feedback: boolean, onTrial: GameProps['onTrial'], rounds?: number, onDone?: () => void) {
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  const played = useRef(0)
  const [fb, setFb] = useState<Fb>(null)
  useEffect(() => {
    levelRef.current = level
  })
  return {
    fb,
    levelRef,
    start() {
      shownAt.current = performance.now()
      itemLevel.current = levelRef.current
    },
    finish(correct: boolean, kind: string, text: string) {
      onTrial({ correct, rt: performance.now() - shownAt.current, level: itemLevel.current, kind })
      if (rounds && ++played.current >= rounds) onDone?.()
      setFb({ ok: correct, text })
    },
    clear: () => setFb(null),
    feedbackMs: feedback ? 1600 : 500,
  }
}

function PuzzleGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRound(level, feedback, onTrial, rounds, onDone)
  const [item, setItem] = useState(() => makeArtPuzzle(level))
  const [order, setOrder] = useState(item.order)
  const [phase, setPhase] = useState<'show' | 'solve'>('show')
  const [sel, setSel] = useState<number | null>(null)
  const [swaps, setSwaps] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('solve')
      r.start()
    }, PREVIEW_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])
  useEffect(() => {
    if (!r.fb) return
    const t = setTimeout(() => {
      const next = makeArtPuzzle(r.levelRef.current)
      r.clear()
      setItem(next)
      setOrder(next.order)
      setSwaps(0)
      setSel(null)
      setPhase('show')
    }, r.feedbackMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.fb])

  function click(slot: number) {
    if (phase !== 'solve' || r.fb) return
    if (sel === null || sel === slot) return setSel(sel === slot ? null : slot)
    const next = [...order]
    ;[next[sel], next[slot]] = [next[slot], next[sel]]
    const n = swaps + 1
    setOrder(next)
    setSwaps(n)
    setSel(null)
    if (next.every((p, i) => p === i)) {
      const min = minSwaps(item.order)
      r.finish(puzzleOk(n, min), `swaps:${n}/${min}`, `rebuilt in ${n} swaps; the fewest possible was ${min}`)
    }
  }
  useGridKeys(gridRef, item.n, () => setSel(null))

  const piece = ART_SIZE / item.n
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {phase === 'show' ? 'Remember this picture' : `Swap pieces to rebuild the picture · Swaps ${swaps}`}
      </div>
      {phase === 'show' ? (
        <div className="hv-artframe">
          <ArtSvg art={item.art} />
          <div key={item.order.join()} className="hv-countdown" style={{ '--timer-ms': `${PREVIEW_MS}ms` } as CSSProperties} aria-hidden="true" />
        </div>
      ) : (
        <div ref={gridRef} className="hv-pieces" style={{ gridTemplateColumns: `repeat(${item.n}, 1fr)` }}>
          {order.map((p, slot) => (
            <button
              key={slot}
              type="button"
              className="hv-cell hv-piece"
              aria-pressed={sel === slot}
              aria-label={`Slot ${slot + 1}: piece ${p + 1}${sel === slot ? ', selected' : ''}`}
              disabled={!!r.fb}
              onClick={() => click(slot)}
            >
              <ArtSvg art={item.art} view={[(p % item.n) * piece, Math.floor(p / item.n) * piece, piece]} />
            </button>
          ))}
        </div>
      )}
      <FeedbackLine fb={r.fb} show={feedback} />
      <div className="game__keys">Arrows move · Space/Enter picks a piece, then a second to swap · Esc cancels</div>
    </div>
  )
}

function ResembleGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRound(level, feedback, onTrial, rounds, onDone)
  const [item, setItem] = useState(() => makeResemble(level))
  const [paint, setPaint] = useState<number[]>(() => Array(item.size * item.size).fill(0))
  const [brush, setBrush] = useState(1)
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    r.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])
  useEffect(() => {
    if (!r.fb) return
    const t = setTimeout(() => {
      const next = makeResemble(r.levelRef.current)
      r.clear()
      setItem(next)
      setPaint(Array(next.size * next.size).fill(0))
      setBrush(1)
    }, r.feedbackMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.fb])

  function cell(i: number) {
    if (r.fb) return
    setPaint((p) => p.map((v, j) => (j === i ? (v === brush ? 0 : brush) : v)))
  }
  function submit() {
    if (r.fb) return
    const ok = sameGrid(paint, item.answer)
    r.finish(ok, resembleKind(item), ok ? 'the grid matches' : 'the expected grid is shown')
  }
  useGridKeys(gridRef, item.size, undefined, (e) => {
    const k = Number(e.key)
    if (e.key.length === 1 && k >= 0 && k <= item.colours) setBrush(k)
    else if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  })

  const instruction =
    item.mode === 'none'
      ? 'Copy the pattern into the empty grid'
      : item.mode === 'shown-turned'
        ? `The pattern is shown turned ${TURN_TEXT[item.turn]}: build it upright`
        : `Build the pattern turned ${TURN_TEXT[item.turn]}`
  const reveal = !!r.fb && feedback && !r.fb.ok
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {instruction}
      </div>
      <div className="hv-resemble">
        <div className="hv-swatches" style={{ gridTemplateColumns: `repeat(${item.size}, 1fr)` }} aria-label="Pattern" role="img">
          {item.shown.map((v, i) => (
            <span key={i} className="hv-swatch" data-c={v} />
          ))}
        </div>
        <div ref={gridRef} className="hv-swatches" style={{ gridTemplateColumns: `repeat(${item.size}, 1fr)` }}>
          {(reveal ? item.answer : paint).map((v, i) => (
            <button
              key={i}
              type="button"
              className="hv-cell hv-swatch"
              data-c={v}
              aria-label={`Row ${Math.floor(i / item.size) + 1}, column ${(i % item.size) + 1}: ${v ? `colour ${v}` : 'empty'}`}
              disabled={!!r.fb}
              onClick={() => cell(i)}
            />
          ))}
        </div>
      </div>
      <div className="game__choices" role="radiogroup" aria-label="Brush">
        {Array.from({ length: item.colours + 1 }, (_, c) => (
          <button key={c} type="button" role="radio" aria-checked={brush === c} className="btn hv-brush" onClick={() => setBrush(c)} disabled={!!r.fb}>
            <span className="hv-swatch hv-swatch--sm" data-c={c} /> <span className="hv-key">{c}</span>
            {c === 0 && ' erase'}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--ink" disabled={!!r.fb} onClick={submit}>
        Submit
      </button>
      <FeedbackLine fb={r.fb} show={feedback} />
      <div className="game__keys">0–{item.colours} pick a colour · arrows move · Space paints · Enter submits</div>
    </div>
  )
}

function FeedbackLine({ fb, show }: { fb: Fb; show: boolean }) {
  return (
    <div className={`game__feedback ${fb && show ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
      {fb && show && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
    </div>
  )
}

/** Arrow keys move focus over the grid's buttons; extra handles everything else. */
function useGridKeys(ref: RefObject<HTMLDivElement | null>, size: number, onEsc?: () => void, extra?: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onEsc?.()
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[e.key]
      if (!d) return extra?.(e)
      e.preventDefault()
      const cells = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      const i = cells.indexOf(document.activeElement as HTMLButtonElement)
      cells[i < 0 ? 0 : Math.min(cells.length - 1, Math.max(0, i + d))]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}

function ImagePuzzleGame(props: GameProps) {
  return props.variant === 'resemble' ? <ResembleGame {...props} /> : <PuzzleGame {...props} />
}

export const imagePuzzle: GameDef = {
  id: 'image-puzzle',
  name: 'Image puzzle',
  skills: ['spatial-memory'],
  howTo: 'Study the picture, then swap its shuffled pieces back into place (or, in Resemble, copy the coloured pattern, turning it when asked).',
  duration: 420,
  targetRt: 30000,
  Component: ImagePuzzleGame satisfies ComponentType<GameProps>,
  details: imagePuzzleDetails,
}
