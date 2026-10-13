import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { shuffle } from './SequenceReasoning'
import './games.css'
import './pymetrics.css'

type Rand = () => number
/** Three pegs, each a stack of disc ids from bottom to top. */
export type Pegs = number[][]
export type TowerPuzzle = { caps: number[]; start: Pegs; goal: Pegs; minMoves: number }

export const keyOf = (p: Pegs) => p.map((s) => s.join(',')).join('|')
/** Every legal single move: lift a top disc onto another peg that has room. */
export function nextStates(p: Pegs, caps: number[]): Pegs[] {
  const out: Pegs[] = []
  for (let a = 0; a < 3; a++) {
    if (!p[a]!.length) continue
    for (let b = 0; b < 3; b++) {
      if (a === b || p[b]!.length >= caps[b]!) continue
      const q = p.map((s) => [...s])
      q[b]!.push(q[a]!.pop()!)
      out.push(q)
    }
  }
  return out
}
/** Minimum moves from `start` to every reachable arrangement. */
export function distances(start: Pegs, caps: number[]) {
  const d = new Map<string, { pegs: Pegs; n: number }>([[keyOf(start), { pegs: start, n: 0 }]])
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    const n = d.get(keyOf(queue[i]!))!.n
    for (const q of nextStates(queue[i]!, caps)) {
      if (d.has(keyOf(q))) continue
      d.set(keyOf(q), { pegs: q, n: n + 1 })
      queue.push(q)
    }
  }
  return d
}

/** Levels 1–7: three discs on pegs holding 3/2/1, solvable in level+1 moves (2–8). Levels 8–10: five discs on 3/3/3, 9–11 moves. */
export function makeTowerPuzzle(level: number, rand: Rand = Math.random): TowerPuzzle {
  const big = level >= 8
  const caps = big ? [3, 3, 3] : [3, 2, 1]
  const start: Pegs = [[], [], []]
  for (const disc of shuffle(Array.from({ length: big ? 5 : 3 }, (_, i) => i), rand)) {
    const open = [0, 1, 2].filter((i) => start[i]!.length < caps[i]!)
    start[open[Math.floor(rand() * open.length)]!]!.push(disc)
  }
  const all = [...distances(start, caps).values()]
  const want = Math.min(level + 1, Math.max(...all.map((x) => x.n)))
  const pool = all.filter((x) => x.n === want)
  const goal = pool[Math.floor(rand() * pool.length)]!
  return { caps, start, goal: goal.pegs, minMoves: goal.n }
}

/** kind = 'tower:<excess moves>:<ms before the first move>', or 'skip:<ms before the first move>'. */
export function towersDetails(trials: Trial[]) {
  const rs = trials.map((t) => t.kind?.match(/^(tower|skip):(?:(\d+):)?(\d+)$/)).filter((m) => m !== null && m !== undefined)
  const solved = rs.filter((m) => m[1] === 'tower')
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  return {
    avgExcessMoves: Math.round(mean(solved.map((m) => Number(m[2]))) * 100) / 100,
    perfectRate: rs.length ? Math.round((solved.filter((m) => m[2] === '0').length / rs.length) * 1000) / 1000 : 0,
    avgPlanningMs: Math.round(mean(rs.map((m) => Number(m[3])))),
  }
}

function Board({ pegs, caps, held, onPeg, small }: { pegs: Pegs; caps: number[]; held?: number | null; onPeg?: (i: number) => void; small?: boolean }) {
  return (
    <div className={`pym-tower ${small ? 'pym-tower--small' : ''}`}>
      {pegs.map((stack, i) => {
        const discs = stack.map((d, j) => (
          <span key={d} className="pym-disc" data-disc={d} data-held={held === i && j === stack.length - 1}>
            {d + 1}
          </span>
        ))
        return onPeg ? (
          <button key={i} type="button" className="pym-peg" style={{ height: `calc(${caps[i]} * var(--disc) + 12px)` }} onClick={() => onPeg(i)} aria-label={`Peg ${i + 1}: ${stack.length ? stack.map((d) => d + 1).join(', ') : 'empty'}`}>
            {discs}
            <span className="pym-key pym-peg__key">{i + 1}</span>
          </button>
        ) : (
          <div key={i} className="pym-peg" style={{ height: `calc(${caps[i]} * var(--disc) + 12px)` }}>
            {discs}
          </div>
        )
      })}
    </div>
  )
}

function TowersGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [puzzle, setPuzzle] = useState(() => makeTowerPuzzle(level))
  const [pegs, setPegs] = useState(puzzle.start)
  const [held, setHeld] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const shownAt = useRef(performance.now())
  const planMs = useRef<number | null>(null)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  const played = useRef(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    levelRef.current = level
    doneRef.current = onDone
  })

  function end(correct: boolean, kind: string, text: string) {
    onTrial({ correct, rt: performance.now() - shownAt.current, level: itemLevel.current, kind })
    setFb({ ok: correct, text })
  }
  function onPeg(i: number) {
    if (fb) return
    if (held === null) return pegs[i]!.length ? setHeld(i) : undefined
    if (held === i || pegs[i]!.length >= puzzle.caps[i]!) return setHeld(null)
    const q = pegs.map((s) => [...s])
    q[i]!.push(q[held]!.pop()!)
    planMs.current ??= Math.round(performance.now() - shownAt.current)
    const n = moves + 1
    setPegs(q)
    setMoves(n)
    setHeld(null)
    if (keyOf(q) === keyOf(puzzle.goal)) {
      const excess = n - puzzle.minMoves
      end(excess === 0, `tower:${excess}:${planMs.current}`, excess === 0 ? `Solved in the minimum ${n} moves` : `Solved in ${n} moves; ${puzzle.minMoves} was possible`)
    }
  }
  function skip() {
    if (!fb) end(false, `skip:${planMs.current ?? Math.round(performance.now() - shownAt.current)}`, `Skipped; it took ${puzzle.minMoves} moves`)
  }

  useEffect(() => {
    if (!fb) return
    const t = setTimeout(
      () => {
        if (rounds && ++played.current >= rounds) return doneRef.current?.()
        itemLevel.current = levelRef.current
        const p = makeTowerPuzzle(levelRef.current)
        setPuzzle(p)
        setPegs(p.start)
        setMoves(0)
        setFb(null)
        planMs.current = null
        shownAt.current = performance.now()
      },
      feedback ? 1400 : 700,
    )
    return () => clearTimeout(t)
  }, [fb, feedback, rounds])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const i = ['1', '2', '3'].indexOf(e.key)
      if (i >= 0) onPeg(i)
      else if (e.key === 'Escape') setHeld(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div className="game__prompt" aria-live="polite">
        Match the target in {puzzle.minMoves} moves. Moves: {moves}
      </div>
      <div className="pym-towers">
        <div>
          <div className="game__sub">Target</div>
          <Board pegs={puzzle.goal} caps={puzzle.caps} small />
        </div>
        <div>
          <div className="game__sub">Yours</div>
          <Board pegs={pegs} caps={puzzle.caps} held={held} onPeg={onPeg} />
        </div>
      </div>
      <button type="button" className="btn btn--quiet" onClick={skip} disabled={!!fb}>
        Skip puzzle
      </button>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && fb.text}
      </div>
      <div className="game__keys">1–3 or tap a peg to lift its top disc, then a peg to drop it · Esc to put it back</div>
    </div>
  )
}

export const towers: GameDef = {
  id: 'towers',
  name: 'Towers',
  skills: ['planning'],
  howTo: 'Move the discs one at a time to match the target, in as few moves as you can. Plan before the first move.',
  duration: 120,
  targetRt: 15000,
  Component: TowersGame satisfies ComponentType<GameProps>,
  details: towersDetails,
}
