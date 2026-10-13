import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './reasoning.css'

type Rand = () => number
/** Non-zero outcomes in percent; the remaining probability pays 0. */
export type RiskOption = { outcomes: { p: number; v: number }[] }
export type RiskItem = { options: [RiskOption, RiskOption]; limitMs: number | null }

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const step5 = (lo: number, hi: number, rand: Rand) => 5 * int(lo / 5, hi / 5, rand)

export const ev = (o: RiskOption) => o.outcomes.reduce((s, x) => s + (x.p / 100) * x.v, 0)
export const variance = (o: RiskOption) => o.outcomes.reduce((s, x) => s + (x.p / 100) * x.v * x.v, 0) - ev(o) ** 2

function option(risky: boolean, two: boolean, rand: Rand): RiskOption {
  if (!two) return { outcomes: [risky ? { p: step5(15, 45, rand), v: step5(60, 150, rand) } : { p: step5(60, 90, rand), v: step5(20, 60, rand) }] }
  return {
    outcomes: risky
      ? [{ p: step5(10, 20, rand), v: step5(100, 200, rand) }, { p: step5(20, 30, rand), v: step5(20, 40, rand) }]
      : [{ p: step5(40, 60, rand), v: step5(30, 60, rand) }, { p: step5(20, 30, rand), v: step5(10, 25, rand) }],
  }
}

/** Relative EV gap shrinks from ~27% at level 1 to 4% from level 10; three-outcome options from 6; a time limit from 5. */
export function makeRiskItem(level: number, rand: Rand = Math.random): RiskItem {
  const minGap = Math.max(0.04, 0.3 - level * 0.028)
  const two = level >= 6
  // ponytail: rejection loop; rounding to 5 keeps acceptance high, so it ends within a few tries.
  for (;;) {
    const safe = option(false, two && rand() < 0.5, rand)
    const risky = option(true, two && rand() < 0.5, rand)
    const target = ev(safe) * (1 + (rand() < 0.5 ? -1 : 1) * (minGap + rand() * 0.15))
    const f = target / ev(risky)
    risky.outcomes = risky.outcomes.map((x) => ({ p: x.p, v: Math.max(5, Math.round((x.v * f) / 5) * 5) }))
    const [a, b] = [ev(safe), ev(risky)]
    const gap = Math.abs(a - b) / Math.max(a, b)
    if (gap < minGap || gap > minGap + 0.25 || variance(safe) >= variance(risky)) continue
    return { options: rand() < 0.5 ? [safe, risky] : [risky, safe], limitMs: level >= 5 ? 9000 - (level - 5) * 1000 : null }
  }
}

/** correct = the higher-EV pick; kind = whether the pick was the lower-variance option. */
export function judgeRisk(item: RiskItem, i: 0 | 1) {
  const [me, other] = [item.options[i], item.options[1 - i]!]
  return { correct: ev(me) > ev(other), kind: variance(me) < variance(other) ? 'safe' : 'risky' }
}

export function draw(o: RiskOption, rand: Rand = Math.random) {
  let r = rand() * 100
  for (const x of o.outcomes) if ((r -= x.p) < 0) return x.v
  return 0
}

export function riskDetails(trials: Trial[]) {
  const picks = trials.filter((t) => t.kind === 'safe' || t.kind === 'risky')
  if (!picks.length) return { evRate: 0, lowVarianceRate: 0 }
  const rate = (n: number) => Math.round((n / picks.length) * 1000) / 1000
  return { evRate: rate(picks.filter((t) => t.correct).length), lowVarianceRate: rate(picks.filter((t) => t.kind === 'safe').length) }
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString()
const LABELS = ['A', 'B'] as const

function RiskRewardGame({ level, feedback, onTrial }: GameProps) {
  const [item, setItem] = useState(() => makeRiskItem(level))
  const [round, setRound] = useState(0)
  const [fb, setFb] = useState<{ ok: boolean; text: string; ms: number } | null>(null)
  const [total, setTotal] = useState(0)
  const [last, setLast] = useState<string | null>(null)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  const explain = `Average per pick: A ${fmt(ev(item.options[0]))}, B ${fmt(ev(item.options[1]))}`
  useEffect(() => {
    shownAt.current = performance.now()
    itemLevel.current = levelRef.current
  }, [item])
  useEffect(() => {
    if (item.limitMs === null || fb) return
    const limit = item.limitMs
    const t = setTimeout(() => {
      onTrial({ correct: false, rt: limit, level: itemLevel.current, kind: 'timeout' })
      setLast('Time ran out, no points')
      setFb({ ok: false, text: explain, ms: feedback ? 1200 : 400 })
    }, limit - (performance.now() - shownAt.current))
    return () => clearTimeout(t)
  }, [item, fb, explain, feedback, onTrial])
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(() => {
      setFb(null)
      setItem(makeRiskItem(levelRef.current))
      setRound((r) => r + 1)
    }, fb.ms)
    return () => clearTimeout(t)
  }, [fb])

  function choose(i: 0 | 1) {
    if (fb) return
    const { correct, kind } = judgeRisk(item, i)
    onTrial({ correct, rt: performance.now() - shownAt.current, level: itemLevel.current, kind })
    const won = draw(item.options[i])
    setTotal((t) => t + won)
    setLast(`${LABELS[i]} paid ${won}`)
    setFb({ ok: correct, text: explain, ms: feedback ? 1200 : 0 })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === '1' || e.key === 'ArrowLeft') choose(0)
      else if (e.key === '2' || e.key === 'ArrowRight') choose(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Pick one option. Points are drawn at random from its chances.
      </div>
      {item.limitMs !== null && <div key={round} className="rsn-timer" style={{ '--timer-ms': `${item.limitMs}ms` } as CSSProperties} aria-hidden="true" />}
      <div className="game__choices">
        {item.options.map((o, i) => {
          const rest = 100 - o.outcomes.reduce((s, x) => s + x.p, 0)
          return (
            <button key={i} type="button" className="btn game__choice rsn-option" disabled={!!fb} onClick={() => choose(i as 0 | 1)}>
              <span className="rsn-option__label">
                <span className="rsn-key">{i + 1}</span> Option {LABELS[i]}
              </span>
              {o.outcomes.map((x, j) => (
                <span key={j} className="rsn-option__row">
                  {x.p}% chance of {x.v} points
                </span>
              ))}
              {rest > 0 && <span className="rsn-option__row rsn-muted">{rest}% chance of 0</span>}
              <span className="rsn-bar" aria-hidden="true">
                {o.outcomes.map((x, j) => (
                  <span key={j} data-tone={j} style={{ width: `${x.p}%` }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <div className="game__prompt rsn-tally">
        {last ? `${last} · ` : ''}Total {total}
      </div>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Higher average' : 'Lower average'}: ${fb.text}`}
      </div>
      <div className="game__keys">1 or ← for A · 2 or → for B</div>
    </div>
  )
}

export const riskReward: GameDef = {
  id: 'risk-reward',
  name: 'Risk and reward',
  skills: ['probabilistic-reasoning'],
  howTo: 'Compare two chances and pick the option that pays more on average; the draw itself is luck.',
  duration: 120,
  targetRt: 4000,
  Component: RiskRewardGame satisfies ComponentType<GameProps>,
  details: riskDetails,
}
