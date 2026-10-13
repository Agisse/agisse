import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import { shuffle } from './SequenceReasoning'
import './games.css'
import './aon.css'

type Rand = () => number
/** [row, col] */
export type Cell = [number, number]
export type LockPuzzle = { rows: number; cols: number; pieces: Cell[][] }

/** Shifts to the origin and sorts row-major, so cells[0] is the top-left filled cell (the placing anchor). */
export const normalize = (cells: Cell[]): Cell[] => {
  const r0 = Math.min(...cells.map((c) => c[0]))
  const c0 = Math.min(...cells.map((c) => c[1]))
  return cells.map(([r, c]): Cell => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
}
/** A quarter turn clockwise. */
export const rotate = (cells: Cell[]) => normalize(cells.map(([r, c]): Cell => [c, -r]))
export const mirror = (cells: Cell[]) => normalize(cells.map(([r, c]): Cell => [r, -c]))
export const turn = (cells: Cell[], k: number) => Array.from({ length: ((k % 4) + 4) % 4 }).reduce<Cell[]>((s) => rotate(s), normalize(cells))
export const shapeKey = (cells: Cell[]) => normalize(cells).join(';')
const extent = (cells: Cell[]) => [Math.max(...cells.map((c) => c[0])) + 1, Math.max(...cells.map((c) => c[1])) + 1] as const

/** Board 3×3 with 3 pieces at level 1 up to 5×5 with 6 pieces at level 10. */
export function lockSize(level: number) {
  const [rows, cols] = level <= 2 ? [3, 3] : level <= 4 ? [3, 4] : level <= 6 ? [4, 4] : level <= 8 ? [4, 5] : [5, 5]
  return { rows, cols, pieces: Math.round((rows * cols) / (2.5 + level * 0.15)) }
}

/** Tiles the board by growing pieces from random seeds (smallest neighbour grows first), then shows each piece at a random turn. */
export function makeLockPuzzle(level: number, rand: Rand = Math.random): LockPuzzle {
  const { rows, cols, pieces: k } = lockSize(level)
  const n = rows * cols
  const nbrs = (i: number) => [i - cols, i + cols, i % cols ? i - 1 : -1, (i + 1) % cols ? i + 1 : -1].filter((j) => j >= 0 && j < n)
  // ponytail: rejection loop on piece sizes 2–5; random growth meets that within a few tries at these board sizes.
  for (;;) {
    const owner = Array<number>(n).fill(-1)
    shuffle([...Array(n).keys()], rand)
      .slice(0, k)
      .forEach((c, p) => (owner[c] = p))
    const size = Array<number>(k).fill(1)
    for (;;) {
      const open = [...Array(n).keys()].filter((i) => owner[i] === -1 && nbrs(i).some((j) => owner[j] !== -1))
      if (!open.length) break
      const i = open[Math.floor(rand() * open.length)]!
      const adj = [...new Set(nbrs(i).map((j) => owner[j]!).filter((p) => p !== -1))]
      const min = Math.min(...adj.map((p) => size[p]!))
      const pick = shuffle(adj.filter((p) => size[p] === min), rand)[0]!
      owner[i] = pick
      size[pick]!++
    }
    if (size.some((s) => s < 2 || s > 5)) continue
    const pieces = Array.from({ length: k }, (_, p) => turn(owner.flatMap((o, i): Cell[] => (o === p ? [[Math.floor(i / cols), i % cols]] : [])), Math.floor(rand() * 4)))
    return { rows, cols, pieces }
  }
}

/** Board cells the piece covers with its anchor (cells[0]) on `at`; null when it leaves the board or overlaps. */
export function placeAt(board: number[], cols: number, piece: Cell[], at: number): number[] | null {
  const rows = board.length / cols
  const [ar, ac] = [Math.floor(at / cols), at % cols]
  const p = normalize(piece)
  const out: number[] = []
  for (const [r, c] of p) {
    const [rr, cc] = [ar + r - p[0]![0], ac + c - p[0]![1]]
    if (rr < 0 || cc < 0 || rr >= rows || cc >= cols || board[rr * cols + cc] !== -1) return null
    out.push(rr * cols + cc)
  }
  return out
}

/** kind 'rot:<turns>/<pieces>' on solved boards, 'gaveup' otherwise. */
export function gridLockDetails(trials: Trial[]) {
  const solved = trials.filter((t) => t.kind?.startsWith('rot:')).map((t) => t.kind!.slice(4).split('/').map(Number))
  const turns = solved.reduce((s, [a]) => s + a!, 0)
  const pieces = solved.reduce((s, [, b]) => s + b!, 0)
  return {
    solveRate: trials.length ? Math.round((solved.length / trials.length) * 1000) / 1000 : 0,
    turnsPerPiece: pieces ? Math.round((turns / pieces) * 100) / 100 : 0,
  }
}

export const PIECE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--ink-3)']

/** Small inline drawing of a polyomino. */
export function PieceArt({ cells, unit = 14, color = 'currentColor' }: { cells: Cell[]; unit?: number; color?: string }) {
  const [h, w] = extent(cells)
  return (
    <svg viewBox={`0 0 ${w * unit} ${h * unit}`} width={w * unit} height={h * unit} aria-hidden="true">
      {cells.map(([r, c]) => (
        <rect key={`${r},${c}`} x={c * unit + 1} y={r * unit + 1} width={unit - 2} height={unit - 2} fill={color} />
      ))}
    </svg>
  )
}

function GridLockGame({ level, mode, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [pz, setPz] = useState(() => makeLockPuzzle(level))
  const [turns, setTurns] = useState<number[]>(() => pz.pieces.map(() => 0))
  const [board, setBoard] = useState<number[]>(() => Array(pz.rows * pz.cols).fill(-1))
  const [sel, setSel] = useState<number | null>(0)
  const [cursor, setCursor] = useState(0)
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const turnCount = useRef(0)
  const shownAt = useRef(performance.now())
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  const placed = (p: number) => board.includes(p)
  const shape = (p: number) => turn(pz.pieces[p]!, turns[p]!)

  function next() {
    const p = makeLockPuzzle(levelRef.current)
    itemLevel.current = levelRef.current
    setPz(p)
    setTurns(p.pieces.map(() => 0))
    setBoard(Array(p.rows * p.cols).fill(-1))
    setSel(0)
    setCursor(0)
    setFb(null)
    turnCount.current = 0
    shownAt.current = performance.now()
  }
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(next, feedback ? 1300 : 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb])

  function finish(ok: boolean) {
    onTrial({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: ok ? `rot:${turnCount.current}/${pz.pieces.length}` : 'gaveup' })
    if (r.count()) return
    setFb({ ok, text: ok ? 'Every square is filled' : 'Skipped this board' })
  }
  function pick(p: number) {
    if (fb || placed(p)) return
    if (sel === p) {
      setTurns((t) => t.map((x, i) => (i === p ? x + 1 : x)))
      turnCount.current++
    } else setSel(p)
  }
  function tapCell(at: number) {
    if (fb) return
    setCursor(at)
    if (board[at] !== -1) {
      const p = board[at]!
      setBoard((b) => b.map((x) => (x === p ? -1 : x)))
      setSel(p)
      return
    }
    if (sel === null || placed(sel)) return
    const cells = placeAt(board, pz.cols, shape(sel), at)
    if (!cells) return
    const nb = board.map((x, i) => (cells.includes(i) ? sel : x))
    setBoard(nb)
    const rest = pz.pieces.map((_, i) => i).filter((i) => !nb.includes(i))
    setSel(rest[0] ?? null)
    if (!rest.length) finish(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fb) return
      const n = Number(e.key)
      if (n >= 1 && n <= pz.pieces.length) return pick(n - 1)
      if ((e.key === 'r' || e.key === 'R') && sel !== null) return pick(sel)
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -pz.cols, ArrowDown: pz.cols }[e.key]
      if (d) {
        e.preventDefault()
        if (d === -1 && cursor % pz.cols === 0) return
        if (d === 1 && cursor % pz.cols === pz.cols - 1) return
        const c = cursor + d
        if (c >= 0 && c < board.length) setCursor(c)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        tapCell(cursor)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const left = pz.pieces.map((_, i) => i).filter((i) => !placed(i))
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {fb ? 'Next board…' : sel !== null && !placed(sel) ? `Piece ${sel + 1} selected: tap it again to turn it, then tap a square for its top-left block` : 'Pick a piece'}
      </div>
      <div className="aon-lock" style={{ gridTemplateColumns: `repeat(${pz.cols}, auto)` }} role="grid" aria-label="Board">
        {board.map((p, i) => (
          <button
            key={i}
            type="button"
            className="aon-lock__cell"
            data-cursor={i === cursor ? 'true' : undefined}
            style={p === -1 ? undefined : { background: PIECE_COLORS[p % PIECE_COLORS.length] }}
            aria-label={`Row ${Math.floor(i / pz.cols) + 1}, column ${(i % pz.cols) + 1}${p === -1 ? ', empty' : `, piece ${p + 1}`}`}
            tabIndex={-1}
            onClick={() => tapCell(i)}
          />
        ))}
      </div>
      <div className="aon-tray">
        {left.map((p) => (
          <button key={p} type="button" className="btn aon-tray__piece" aria-pressed={sel === p} aria-label={`Piece ${p + 1}${sel === p ? ', selected; press again to turn' : ''}`} onClick={() => pick(p)}>
            <span className="rsn-key">{p + 1}</span>
            <PieceArt cells={shape(p)} color={PIECE_COLORS[p % PIECE_COLORS.length]} />
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--quiet" disabled={!!fb} onClick={() => finish(false)}>
        Skip board
      </button>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && fb.text}
      </div>
      <div className="game__keys">1–{pz.pieces.length} pick · R turn · arrows move · Enter place or lift</div>
    </div>
  )
}

export const gridLock: GameDef = {
  id: 'grid-lock',
  name: 'Grid Lock',
  skills: ['planning'],
  howTo: 'Turn and place every piece so the board is filled exactly, with no gaps or overlaps.',
  duration: 180,
  targetRt: 20000,
  Component: GridLockGame satisfies ComponentType<GameProps>,
  details: gridLockDetails,
}
