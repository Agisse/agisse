import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './hirevue.css'

type Rand = () => number
/** Openings as a bit mask: N 1, E 2, S 4, W 8. Every tile is a two-way pipe. */
export const N = 1
export const E = 2
export const S = 4
export const W = 8
export const PIPES = [N | S, E | W, N | E, E | S, S | W, W | N] as const
/** tiles row-major; the route enters at the left of startRow and leaves at the right of endRow; par = swaps used to scramble. */
export type PathPuzzle = { size: number; tiles: number[]; startRow: number; endRow: number; par: number }

const STEP: Record<number, [number, number]> = { [N]: [-1, 0], [E]: [0, 1], [S]: [1, 0], [W]: [0, -1] }
const opposite = (d: number) => (d === N ? S : d === S ? N : d === E ? W : E)

/** The cells the route passes through from the start, and whether it reaches the exit. */
export function trace(p: Pick<PathPuzzle, 'size' | 'tiles' | 'startRow' | 'endRow'>): { cells: number[]; solved: boolean } {
  let [r, c, from] = [p.startRow, 0, W]
  const cells: number[] = []
  while (r >= 0 && r < p.size && c >= 0 && c < p.size && cells.length <= p.size * p.size) {
    const t = p.tiles[r * p.size + c]
    if (!(t & from)) break
    cells.push(r * p.size + c)
    const out = t & ~from
    if (c === p.size - 1 && out === E) return { cells, solved: r === p.endRow }
    ;[r, c, from] = [r + STEP[out][0], c + STEP[out][1], opposite(out)]
  }
  return { cells, solved: false }
}

/** Grid 4 → 6, scramble swaps 2 → 6. Builds a left-to-right route, fills the rest at random, then swaps k route tiles away. */
export function makePuzzle(level: number, rand: Rand = Math.random): PathPuzzle {
  const size = level <= 3 ? 4 : level <= 6 ? 5 : 6
  const par = 1 + Math.ceil(level / 2)
  const rnd = (n: number) => Math.floor(rand() * n)
  const tiles = Array.from({ length: size * size }, () => PIPES[rnd(PIPES.length)])
  const startRow = rnd(size)
  let r = startRow
  for (let c = 0; c < size; c++) {
    // Enter from the west, run vertically to a random row in this column, leave east.
    const to = rnd(size)
    const dir = to > r ? S : N
    if (to === r) tiles[r * size + c] = E | W
    else {
      tiles[r * size + c] = W | dir
      for (let y = r + (dir === S ? 1 : -1); y !== to; y += dir === S ? 1 : -1) tiles[y * size + c] = N | S
      tiles[to * size + c] = opposite(dir) | E
    }
    r = to
  }
  const p = { size, tiles, startRow, endRow: r, par }
  const route = trace(p).cells
  // ponytail: each swap moves one route tile, so `par` swaps always suffice; the true minimum can be lower.
  for (;;) {
    const t = [...tiles]
    for (let i = 0; i < par; i++) {
      const a = route[rnd(route.length)]
      const b = rnd(size * size)
      ;[t[a], t[b]] = [t[b], t[a]]
    }
    if (!trace({ ...p, tiles: t }).solved) return { ...p, tiles: t }
  }
}

export const swapTiles = (tiles: number[], a: number, b: number) => tiles.map((t, i) => (i === a ? tiles[b] : i === b ? tiles[a] : t))
/** Solved within par swaps. kind 'swaps:5/4' (used/par) or 'skip'. */
export const pathKind = (swaps: number, par: number) => `swaps:${swaps}/${par}`

export function pathDetails(trials: Trial[]) {
  const done = trials.map((t) => (t.kind ?? '').match(/^swaps:(\d+)\/(\d+)$/)).filter((m) => m) as RegExpMatchArray[]
  const skips = trials.filter((t) => t.kind === 'skip').length
  const extra = done.map((m) => Number(m[1]) - Number(m[2]))
  return { solved: done.length, skips, meanExtraSwaps: extra.length ? Math.round((extra.reduce((a, b) => a + b, 0) / extra.length) * 10) / 10 : 0 }
}

function Pipe({ mask, on }: { mask: number; on: boolean }) {
  const ends: Record<number, string> = { [N]: '20,0', [E]: '40,20', [S]: '20,40', [W]: '0,20' }
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="hv-pipe" data-on={on}>
      {[N, E, S, W]
        .filter((d) => mask & d)
        .map((d) => (
          <path key={d} d={`M20,20 L${ends[d]}`} />
        ))}
      <circle cx="20" cy="20" r="5" />
    </svg>
  )
}

const DIR_NAME: Record<number, string> = { [N]: 'up', [E]: 'right', [S]: 'down', [W]: 'left' }

function PathfinderGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [puzzle, setPuzzle] = useState(() => makePuzzle(level))
  const [tiles, setTiles] = useState(puzzle.tiles)
  const [sel, setSel] = useState<number | null>(null)
  const [swaps, setSwaps] = useState(0)
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
  }, [puzzle])
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(
      () => {
        const p = makePuzzle(levelRef.current)
        setFb(null)
        setPuzzle(p)
        setTiles(p.tiles)
        setSwaps(0)
        setSel(null)
      },
      feedback ? 1600 : 600,
    )
    return () => clearTimeout(t)
  }, [fb, feedback])

  function record(t: Trial) {
    onTrial(t)
    if (rounds && ++played.current >= rounds) onDone?.()
  }
  function click(i: number) {
    if (fb) return
    if (sel === null) return setSel(i)
    if (sel === i) return setSel(null)
    const next = swapTiles(tiles, sel, i)
    const n = swaps + 1
    setTiles(next)
    setSwaps(n)
    setSel(null)
    if (trace({ ...puzzle, tiles: next }).solved) {
      const ok = n <= puzzle.par
      record({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: pathKind(n, puzzle.par) })
      setFb({ ok, text: `connected in ${n} swap${n === 1 ? '' : 's'} (par ${puzzle.par})` })
    }
  }
  function skip() {
    if (fb) return
    record({ correct: false, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: 'skip' })
    setFb({ ok: false, text: 'skipped; the next grid is easier' })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setSel(null)
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.size, ArrowDown: puzzle.size }[e.key]
      if (!d) return
      e.preventDefault()
      const cells = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('.hv-cell') ?? [])]
      const i = cells.indexOf(document.activeElement as HTMLButtonElement)
      cells[i < 0 ? 0 : Math.min(cells.length - 1, Math.max(0, i + d))]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const { cells: lit, solved } = trace({ ...puzzle, tiles })
  const { size } = puzzle
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Swap tiles to join ▶ to ■ · Swaps {swaps} (par {puzzle.par})
      </div>
      <div className="hv-board" style={{ gridTemplateColumns: `20px repeat(${size}, auto) 20px` }}>
        {Array.from({ length: size }, (_, r) => [
          <span key={`s${r}`} className="hv-edge" aria-hidden="true">
            {r === puzzle.startRow ? '▶' : ''}
          </span>,
          ...Array.from({ length: size }, (_, c) => {
            const i = r * size + c
            const names = [N, E, S, W].filter((d) => tiles[i] & d).map((d) => DIR_NAME[d])
            return (
              <button
                key={i}
                type="button"
                className="hv-cell"
                aria-pressed={sel === i}
                aria-label={`Row ${r + 1}, column ${c + 1}: ${names.join('–')}${sel === i ? ', selected' : ''}`}
                disabled={!!fb}
                onClick={() => click(i)}
              >
                <Pipe mask={tiles[i]} on={lit.includes(i)} />
              </button>
            )
          }),
          <span key={`e${r}`} className="hv-edge" aria-hidden="true">
            {r === puzzle.endRow ? '■' : ''}
          </span>,
        ])}
      </div>
      <button type="button" className="btn btn--quiet" disabled={!!fb} onClick={skip}>
        Skip (easier grid)
      </button>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Right' : solved ? 'Connected, over par' : 'Skipped'}: ${fb.text}`}
      </div>
      <div className="game__keys">Arrows move · Space/Enter picks a tile, then a second to swap · Esc cancels</div>
    </div>
  )
}

export const pathfinder: GameDef = {
  id: 'pathfinder',
  name: 'Pathfinder',
  skills: ['planning'],
  howTo: 'Swap pairs of pipe tiles until one unbroken route runs from ▶ to ■, in as few swaps as you can.',
  duration: 300,
  targetRt: 25000,
  Component: PathfinderGame satisfies ComponentType<GameProps>,
  details: pathDetails,
}
