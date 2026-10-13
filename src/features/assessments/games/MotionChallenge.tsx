import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import './games.css'
import './reasoning.css'
import './aon.css'

type Rand = () => number
const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))

// ---- Variant 'moves': slide the ball or a block one cell per move; walls are fixed; blocks can't enter the exit.

export type MovesBoard = { size: number; walls: number[]; blocks: number[]; ball: number; exit: number }
export type MovesPuzzle = MovesBoard & { optimum: number }

const step = (size: number, i: number, d: number) => {
  if (d === -1 && i % size === 0) return -1
  if (d === 1 && i % size === size - 1) return -1
  const j = i + d
  return j >= 0 && j < size * size ? j : -1
}
/** Where object `obj` (0 = ball, k = blocks[k-1]) lands moving one cell in direction d (±1, ±size); null when blocked. */
export function moveObject(b: MovesBoard, obj: number, d: number): MovesBoard | null {
  const at = obj === 0 ? b.ball : b.blocks[obj - 1]!
  const to = step(b.size, at, d)
  if (to < 0 || b.walls.includes(to) || to === b.ball || b.blocks.includes(to) || (obj > 0 && to === b.exit)) return null
  return obj === 0 ? { ...b, ball: to } : { ...b, blocks: b.blocks.map((x, i) => (i === obj - 1 ? to : x)) }
}

/** Fewest moves to get the ball on the exit (BFS); null if unsolvable within maxDepth or the state cap. ballOnly keeps blocks fixed. */
export function solveMoves(start: MovesBoard, maxDepth = 30, ballOnly = false, cap = 60000): number | null {
  const { size, exit } = start
  const N = size * size
  const wall = new Uint8Array(N)
  for (const w of start.walls) wall[w] = 1
  // Neighbour table: up to 4 cells per cell, -1 off the board or into a wall.
  const nb = new Int16Array(N * 4)
  for (let i = 0; i < N; i++) [-1, 1, -size, size].forEach((d, k) => (nb[i * 4 + k] = ((t) => (t >= 0 && !wall[t] ? t : -1))(step(size, i, d))))
  const nObj = 1 + start.blocks.length
  // State = [ball, ...sorted blocks] packed base N into one number (≤ 4 objects on ≤ 36 cells stays exact).
  const pack = (st: number[]) => st.reduce((k, x) => k * N + x, 0)
  const unpack = (k: number, out: number[]) => {
    for (let i = nObj - 1; i >= 0; i--) {
      out[i] = k % N
      k = Math.floor(k / N)
    }
  }
  const first = pack([start.ball, ...[...start.blocks].sort((x, y) => x - y)])
  const seen = new Set([first])
  let layer = [first]
  const st: number[] = Array(nObj).fill(0)
  const n: number[] = Array(nObj).fill(0)
  for (let depth = 0; depth <= maxDepth && layer.length; depth++) {
    const next: number[] = []
    for (const k of layer) {
      unpack(k, st)
      if (st[0] === exit) return depth
      for (let obj = 0; obj < (ballOnly ? 1 : nObj); obj++)
        for (let dk = 0; dk < 4; dk++) {
          const to = nb[st[obj]! * 4 + dk]!
          if (to < 0 || (obj > 0 && to === exit)) continue
          let taken = false
          for (let j = 0; j < nObj; j++) if (st[j] === to) taken = true
          if (taken) continue
          for (let j = 0; j < nObj; j++) n[j] = st[j]!
          n[obj] = to
          // Re-sort the blocks (insertion sort; at most 3).
          for (let a = 2; a < nObj; a++) for (let b = a; b > 1 && n[b - 1]! > n[b]!; b--) [n[b - 1], n[b]] = [n[b]!, n[b - 1]!]
          const key = pack(n)
          if (seen.has(key)) continue
          seen.add(key)
          next.push(key)
        }
    }
    if (seen.size > cap) return null
    layer = next
  }
  return null
}

/** Grid 4×4 → 6×6, blocks 1 → 3, optimum from 2–6 moves (level 1) to 8–12 (level 10); from level 3 the ball alone can't do it as fast. */
export function makeMovesPuzzle(level: number, rand: Rand = Math.random): MovesPuzzle {
  const size = level <= 3 ? 4 : level <= 7 ? 5 : 6
  const nBlocks = level <= 2 ? 1 : level <= 6 ? 2 : 3
  const lo = 2 + Math.floor(level * 0.65)
  const hi = lo + 4
  // ponytail: rejection sampling with a capped BFS per try; the check file times it at every level.
  for (;;) {
    const cells = [...Array(size * size).keys()]
    const take = () => cells.splice(Math.floor(rand() * cells.length), 1)[0]!
    const ball = take()
    const exit = take()
    const blocks = Array.from({ length: nBlocks }, take)
    // Denser walls on 6×6: fewer reachable states keeps the BFS, and so generation, fast.
    const walls = Array.from({ length: Math.floor(size * size * (size === 6 ? 0.3 : 0.22)) }, take)
    const b = { size, walls, blocks, ball, exit }
    // Cheap rejections first: with blocks fixed the ball needs `solo` moves, and opt ≤ solo.
    const solo = solveMoves(b, hi, true)
    if (solo !== null && solo < lo) continue
    // From level 3 moving a block must beat the ball's own route.
    const opt = solveMoves(b, solo === null ? hi : level >= 3 ? solo - 1 : solo)
    if (opt === null || opt < lo) continue
    return { ...b, optimum: opt }
  }
}

// ---- Variant 'distance': route the marble along tracks to the star; correct = the shortest total length.

export type Track = { nodes: { x: number; y: number }[]; edges: [number, number][]; start: number; goal: number; best: number }
const dist = (t: Pick<Track, 'nodes'>, a: number, b: number) => Math.hypot(t.nodes[a]!.x - t.nodes[b]!.x, t.nodes[a]!.y - t.nodes[b]!.y)
export const neighbours = (t: Pick<Track, 'edges'>, n: number) => t.edges.flatMap(([a, b]) => (a === n ? [b] : b === n ? [a] : []))
export const pathLength = (t: Pick<Track, 'nodes'>, path: number[]) => path.slice(1).reduce((s, n, i) => s + dist(t, path[i]!, n), 0)

/** Dijkstra; returns [length, path] or null when the goal is unreachable. */
export function shortest(t: Omit<Track, 'best'>, skip?: [number, number]): [number, number[]] | null {
  const n = t.nodes.length
  const d = Array<number>(n).fill(Infinity)
  const prev = Array<number>(n).fill(-1)
  const done = Array<boolean>(n).fill(false)
  d[t.start] = 0
  for (;;) {
    let u = -1
    for (let i = 0; i < n; i++) if (!done[i] && d[i]! < Infinity && (u < 0 || d[i]! < d[u]!)) u = i
    if (u < 0) return null
    if (u === t.goal) break
    done[u] = true
    for (const v of neighbours(t, u)) {
      if (skip && ((skip[0] === u && skip[1] === v) || (skip[0] === v && skip[1] === u))) continue
      const nd = d[u]! + dist(t, u, v)
      if (nd < d[v]!) [d[v], prev[v]] = [nd, u]
    }
  }
  const path = [t.goal]
  while (path[0] !== t.start) path.unshift(prev[path[0]!]!)
  return [d[t.goal]!, path]
}
/** Second-shortest route: it differs from the best by at least one edge, so drop each best edge in turn. */
export function runnerUp(t: Omit<Track, 'best'>, best: number[]) {
  return Math.min(...best.slice(1).map((v, i) => shortest(t, [best[i]!, v])?.[0] ?? Infinity))
}

/** Lattice 4×3 → 6×4 with jittered stations; the best route beats the runner-up by 15% at level 1, 3% at level 10. */
export function makeTrack(level: number, rand: Rand = Math.random): Track {
  const cols = level <= 3 ? 4 : level <= 7 ? 5 : 6
  const rows = level <= 5 ? 3 : 4
  const margin = 0.15 - (Math.min(10, Math.max(1, level)) - 1) * 0.0133
  for (;;) {
    const nodes = Array.from({ length: rows * cols }, (_, i) => ({ x: (i % cols) + (rand() - 0.5) * 0.6, y: Math.floor(i / cols) + (rand() - 0.5) * 0.6 }))
    const edges: [number, number][] = []
    for (let i = 0; i < nodes.length; i++) {
      const [r, c] = [Math.floor(i / cols), i % cols]
      if (c < cols - 1 && rand() < 0.7) edges.push([i, i + 1])
      if (r < rows - 1 && rand() < 0.7) edges.push([i, i + cols])
      // At most one diagonal per lattice square, so tracks never cross.
      if (r < rows - 1 && c < cols - 1 && rand() < 0.35) edges.push(rand() < 0.5 ? [i, i + cols + 1] : [i + 1, i + cols])
    }
    const start = int(0, rows - 1, rand) * cols
    const goal = int(0, rows - 1, rand) * cols + cols - 1
    const t = { nodes, edges, start, goal }
    const s = shortest(t)
    if (!s || s[1].length < 4) continue
    const second = runnerUp(t, s[1])
    if (second === Infinity || second / s[0] - 1 < margin) continue
    return { ...t, best: s[0] }
  }
}

/** kind 'extra:<n>' (extra moves, or % extra distance) when finished, 'skip' when skipped. */
export function motionDetails(trials: Trial[]) {
  const done = trials.filter((t) => t.kind?.startsWith('extra:')).map((t) => Number(t.kind!.slice(6)))
  const r = (x: number) => Math.round(x * 1000) / 1000
  return {
    optimalRate: trials.length ? r(trials.filter((t) => t.correct).length / trials.length) : 0,
    meanExtra: done.length ? r(done.reduce((a, b) => a + b, 0) / done.length) : 0,
    skipRate: trials.length ? r(trials.filter((t) => t.kind === 'skip').length / trials.length) : 0,
  }
}

type Props = GameProps & { finish: (correct: boolean, kind: string) => void; fb: { ok: boolean; text: string } | null }

function MovesBoardView({ level, finish, fb }: Props) {
  const [pz] = useState(() => makeMovesPuzzle(level))
  const [b, setB] = useState<MovesBoard>(pz)
  const [sel, setSel] = useState(0)
  const [moves, setMoves] = useState(0)
  const at = (o: number) => (o === 0 ? b.ball : b.blocks[o - 1]!)
  function move(d: number) {
    if (fb) return
    const n = moveObject(b, sel, d)
    if (!n) return
    setB(n)
    setMoves(moves + 1)
    if (n.ball === n.exit) finish(moves + 1 === pz.optimum, `extra:${moves + 1 - pz.optimum}`)
  }
  function tap(i: number) {
    const o = i === b.ball ? 0 : b.blocks.indexOf(i) + 1
    if (o > 0 || i === b.ball) return setSel(o)
    const d = i - at(sel)
    if ([-1, 1, -b.size, b.size].includes(d) && step(b.size, at(sel), d) === i) move(d)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -b.size, ArrowDown: b.size }[e.key]
      if (d) {
        e.preventDefault()
        move(d)
      } else if (e.key === 'n' || e.key === 'N') setSel((sel + 1) % (b.blocks.length + 1))
      else if (e.key === 's' || e.key === 'S') finish(false, 'skip')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <>
      <div className="game__prompt tnum" aria-live="polite">
        Moves {moves} · best possible {pz.optimum} · moving the {sel === 0 ? 'ball' : `block ${sel}`}
      </div>
      <div className="aon-board" style={{ gridTemplateColumns: `repeat(${b.size}, auto)` }}>
        {Array.from({ length: b.size * b.size }, (_, i) => {
          const o = i === b.ball ? 0 : b.blocks.indexOf(i) + 1
          const what = b.walls.includes(i) ? 'wall' : i === b.ball ? 'ball' : o > 0 ? 'block' : i === b.exit ? 'exit' : 'empty'
          return (
            <button key={i} type="button" className="aon-board__cell" data-what={what} data-sel={(o > 0 || i === b.ball) && o === sel ? 'true' : undefined} disabled={!!fb || what === 'wall'} aria-label={`${what}, row ${Math.floor(i / b.size) + 1}, column ${(i % b.size) + 1}`} onClick={() => tap(i)}>
              {what === 'block' ? o : ''}
            </button>
          )
        })}
      </div>
      <button type="button" className="btn btn--quiet" disabled={!!fb} onClick={() => finish(false, 'skip')}>
        Skip puzzle
      </button>
      <div className="game__keys">Tap a piece, then a cell next to it · arrows move · N next piece · S skip</div>
    </>
  )
}

function TrackView({ level, finish, fb }: Props) {
  const [t] = useState(() => makeTrack(level))
  const [path, setPath] = useState([t.start])
  const here = path[path.length - 1]!
  const options = neighbours(t, here).filter((n) => !path.includes(n))
  function go(n: number) {
    if (fb) return
    if (path.length > 1 && n === path[path.length - 2]) return setPath(path.slice(0, -1))
    if (!options.includes(n)) return
    const p = [...path, n]
    setPath(p)
    if (n === t.goal) {
      const len = pathLength(t, p)
      finish(len <= t.best + 1e-9, `extra:${Math.round((len / t.best - 1) * 100)}`)
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = Number(e.key)
      if (k >= 1 && k <= options.length) go(options[k - 1]!)
      else if (e.key === 'Backspace' && path.length > 1) setPath(path.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const xs = t.nodes.map((n) => n.x)
  const ys = t.nodes.map((n) => n.y)
  const [x0, y0] = [Math.min(...xs) - 0.5, Math.min(...ys) - 0.5]
  const vb = `${x0} ${y0} ${Math.max(...xs) - x0 + 0.5} ${Math.max(...ys) - y0 + 0.5}`
  const onPath = (a: number, b: number) => path.some((n, i) => i > 0 && ((path[i - 1] === a && n === b) || (path[i - 1] === b && n === a)))
  return (
    <>
      <div className="game__prompt" aria-live="polite">
        Take the marble to the star by the shortest route{options.length ? ` · next stops: ${options.map((_, i) => i + 1).join(', ')}` : ''}
      </div>
      <svg className="aon-track" viewBox={vb} role="group" aria-label="Track map">
        {t.edges.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={t.nodes[a]!.x} y1={t.nodes[a]!.y} x2={t.nodes[b]!.x} y2={t.nodes[b]!.y} data-on={onPath(a, b) ? 'true' : undefined} />
        ))}
        {t.nodes.map((n, i) => {
          const k = options.indexOf(i)
          const label = i === t.goal ? 'star' : i === here ? 'marble' : k >= 0 ? `stop ${k + 1}` : 'stop'
          return (
            <g key={i} className="aon-track__node" data-opt={k >= 0 ? 'true' : undefined} onClick={() => go(i)} role={k >= 0 ? 'button' : undefined} aria-label={label}>
              <circle cx={n.x} cy={n.y} r={i === here ? 0.2 : 0.12} data-here={i === here ? 'true' : undefined} />
              {i === t.goal && i !== here && <text x={n.x} y={n.y + 0.1} textAnchor="middle" className="aon-track__star">★</text>}
              {k >= 0 && (
                <text x={n.x + 0.18} y={n.y - 0.16} className="aon-track__key">
                  {k + 1}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="game__keys">Tap a connected stop, or press its number · Backspace or tap back to undo</div>
    </>
  )
}

function MotionChallengeGame(props: GameProps) {
  const { level, mode, feedback, onTrial, rounds, onDone, variant } = props
  const r = useRounds({ rounds, onDone, mode })
  const [item, setItem] = useState({ n: 0, level })
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const shownAt = useRef(performance.now())
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(
      () => {
        shownAt.current = performance.now()
        setFb(null)
        setItem((x) => ({ n: x.n + 1, level: levelRef.current }))
      },
      feedback ? 1300 : 300,
    )
    return () => clearTimeout(t)
  }, [fb, feedback])
  function finish(correct: boolean, kind: string) {
    if (fb) return
    onTrial({ correct, rt: performance.now() - shownAt.current, level: item.level, kind })
    if (r.count()) return
    const extra = Number(kind.slice(6))
    const text = kind === 'skip' ? 'Skipped' : correct ? 'Right: the shortest way' : variant === 'distance' ? `${extra}% longer than the shortest route` : `${extra} more move${extra === 1 ? '' : 's'} than needed`
    setFb({ ok: correct, text })
  }
  const View = variant === 'distance' ? TrackView : MovesBoardView
  return (
    <div className="game">
      <View key={item.n} {...props} level={item.level} finish={finish} fb={fb} />
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && fb.text}
      </div>
    </div>
  )
}

export const motionChallenge: GameDef = {
  id: 'motion-challenge',
  name: 'Motion challenge',
  skills: ['planning'],
  howTo: 'Get the ball to the exit in as few moves as you can, sliding blocks out of the way one square at a time.',
  duration: 360,
  targetRt: 15000,
  Component: MotionChallengeGame satisfies ComponentType<GameProps>,
  details: motionDetails,
}
