import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { shuffle } from './SequenceReasoning'
import './games.css'
import './pymetrics.css'

type Rand = () => number
export const CENTS_PER_PUMP = 5
/** Hidden pop-point ceilings, one per colour: a balloon pops on a pump drawn uniformly from 1…max. */
export const MAXES = [8, 32, 128] as const
export type Balloon = { max: number; popAt: number }

/** Expected bank n·(max−n)/max peaks at n = max/2. */
export const optimumPumps = (max: number) => max / 2

// ponytail: no difficulty axis; the balloon task is the same at every level, as in the real game.
export function makeBalloon(rand: Rand = Math.random): Balloon {
  const max = MAXES[Math.floor(rand() * MAXES.length)]!
  return { max, popAt: 1 + Math.floor(rand() * max) }
}
/**
 * A good decision under risk, not a lucky outcome: banking within half to one and a half times the colour's optimum,
 * or popping before passing one and a half times it (a pop on the way to the best stop is bad luck, not a bad plan).
 * Banking after one pump every time never pops, but leaves most of the money on the table.
 */
export const wellJudged = (max: number, pumps: number, popped: boolean) => {
  const best = optimumPumps(max)
  return popped ? pumps <= 1.5 * best : pumps >= 0.5 * best && pumps <= 1.5 * best
}
/** The n-th pump pops the balloon once n reaches its pop point. */
export const pops = (b: Balloon, pumps: number) => pumps >= b.popAt

const parse = (kind?: string) => {
  const m = kind?.match(/^(collect|pop):(\d+):(\d+)$/)
  return m ? { popped: m[1] === 'pop', max: Number(m[2]), pumps: Number(m[3]) } : null
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * kind = 'collect|pop:<max>:<pumps>'. adaptation > 0 means the second half of each colour's balloons sat closer to
 * its optimum (max/2) than the first half, as a share of that optimum, averaged over colours seen in both halves.
 */
export function balloonDetails(trials: Trial[]) {
  const all = trials.map((t) => parse(t.kind)).filter((b) => b !== null)
  const kept = all.filter((b) => !b.popped)
  const out: Record<string, number> = {
    avgPumpsUnpopped: r2(mean(kept.map((b) => b.pumps))),
    popRate: all.length ? r2(all.filter((b) => b.popped).length / all.length) : 0,
  }
  const moves: number[] = []
  for (const max of MAXES) {
    const mine = all.filter((b) => b.max === max)
    out[`avgPumpsMax${max}`] = r2(mean(mine.filter((b) => !b.popped).map((b) => b.pumps)))
    const half = mine.length >> 1
    if (half < 1) continue
    const off = (bs: typeof mine) => Math.abs(mean(bs.map((b) => b.pumps)) - optimumPumps(max)) / optimumPumps(max)
    moves.push(off(mine.slice(0, half)) - off(mine.slice(half)))
  }
  out.adaptation = r2(mean(moves))
  return out
}

const COLOURS = ['red', 'yellow', 'blue'] as const
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

function BalloonsGame({ level, feedback, onTrial, variant, rounds, onDone }: GameProps) {
  const arctic = variant === 'arctic'
  const keys = arctic ? { pump: 'p', collect: 'q', pumpLabel: 'P', collectLabel: 'Q' } : { pump: ' ', collect: 'Enter', pumpLabel: 'Space', collectLabel: 'Enter' }
  // Which colour hides which ceiling is drawn per session.
  const [colourOf] = useState(() => {
    const c = shuffle([...COLOURS], Math.random)
    return (max: number) => c[MAXES.indexOf(max as (typeof MAXES)[number])]!
  })
  const [balloon, setBalloon] = useState(() => makeBalloon())
  const [pumps, setPumps] = useState(0)
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState<{ popped: boolean; text: string } | null>(null)
  const [popLog, setPopLog] = useState<Record<string, number[]>>({})
  const startedAt = useRef(performance.now())
  const played = useRef(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  function finish(popped: boolean, n: number) {
    onTrial({ correct: wellJudged(balloon.max, n, popped), rt: performance.now() - startedAt.current, level, kind: `${popped ? 'pop' : 'collect'}:${balloon.max}:${n}` })
    if (popped) setPopLog((l) => ({ ...l, [colourOf(balloon.max)]: [...(l[colourOf(balloon.max)] ?? []), n] }))
    else setTotal((t) => t + n * CENTS_PER_PUMP)
    setDone({ popped, text: popped ? `Popped on pump ${n}: ${money(n * CENTS_PER_PUMP)} lost` : `Banked ${money(n * CENTS_PER_PUMP)}` })
  }
  function pump() {
    if (done) return
    const n = pumps + 1
    setPumps(n)
    if (pops(balloon, n)) finish(true, n)
  }
  function collect() {
    if (!done && pumps > 0) finish(false, pumps)
  }

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => {
      if (rounds && ++played.current >= rounds) return doneRef.current?.()
      setDone(null)
      setPumps(0)
      setBalloon(makeBalloon())
      startedAt.current = performance.now()
    }, 1100)
    return () => clearTimeout(t)
  }, [done, rounds])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (k === keys.pump) {
        e.preventDefault()
        pump()
      } else if (k === keys.collect) {
        e.preventDefault()
        collect()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const colour = colourOf(balloon.max)
  const scale = 0.45 + Math.min(1, Math.sqrt(pumps / 100)) * 0.75
  const history = popLog[colour]
  return (
    <div className="game">
      <div className="game__prompt">Pump to grow the bank, collect before it pops. Each colour has its own limit.</div>
      <svg className="pym-balloon" viewBox="0 0 200 240" role="img" aria-label={`${colour} balloon, ${pumps} pumps`}>
        {done?.popped ? (
          <text x="100" y="110" textAnchor="middle" className="pym-balloon__pop">
            POP
          </text>
        ) : (
          <g className="pym-balloon__body" style={{ transform: `scale(${scale})` }} data-colour={colour}>
            <path d="M100 210 q-6 15 4 30" className="pym-balloon__string" />
            <ellipse cx="100" cy="105" rx="80" ry="95" />
            <path d="M92 202 h16 l-8 -10 z" />
          </g>
        )}
      </svg>
      <div className="game__prompt pym-tally">
        <span style={{ textTransform: 'capitalize' }}>{colour}</span> balloon {money(pumps * CENTS_PER_PUMP)} · Total {money(total)}
      </div>
      <div className="game__choices">
        <button type="button" className="btn game__choice" disabled={!!done} onClick={pump}>
          Pump <span className="pym-key">{keys.pumpLabel}</span>
        </button>
        <button type="button" className="btn btn--primary game__choice" disabled={!!done || pumps === 0} onClick={collect}>
          {arctic ? 'Bank' : 'Collect'} <span className="pym-key">{keys.collectLabel}</span>
        </button>
      </div>
      <div className={`game__feedback ${done ? (done.popped ? 'game__feedback--bad' : 'game__feedback--ok') : ''}`} aria-live="polite">
        {done?.text}
        {done && feedback && history?.length ? ` · ${colour} balloons popped at ${history.join(', ')} so far` : ''}
      </div>
      <div className="game__keys">
        {keys.pumpLabel} to pump ({money(CENTS_PER_PUMP)} each) · {keys.collectLabel} to {arctic ? 'bank' : 'collect'}
      </div>
    </div>
  )
}

export const balloons: GameDef = {
  id: 'balloons',
  name: 'Balloons',
  skills: ['probabilistic-reasoning'],
  howTo: 'Each pump adds 5 cents to the balloon; collect to keep it, but a pop loses it. Learn how far each colour goes.',
  duration: 180,
  targetRt: 6000,
  Component: BalloonsGame satisfies ComponentType<GameProps>,
  details: balloonDetails,
}
