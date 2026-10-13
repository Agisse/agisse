import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps } from '../engine/types'
import { moveChoiceFocus, shuffle } from './SequenceReasoning'
import './games.css'
import './reasoning.css'

type Rand = () => number
export type EstItem =
  | { type: 'dots'; target: number; groups: [number, number][][]; answer: number; showMs: number; explain: string }
  | { type: 'bars'; target: number; bars: number[]; answer: number; explain: string }

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const BOX = 120

function scatter(n: number, rand: Rand) {
  const pts: [number, number][] = []
  for (let tries = 0; pts.length < n; tries++) {
    const p: [number, number] = [6 + rand() * (BOX - 12), 6 + rand() * (BOX - 12)]
    if (tries < 3000 && pts.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < 7)) continue
    pts.push(p)
  }
  return pts
}

/** 2 → 4 groups; the other groups differ from the target by a ratio of 1.55 at level 1 down to 1.12 at 10. */
export function makeDotsItem(level: number, rand: Rand = Math.random): EstItem {
  const m = level <= 3 ? 2 : level <= 7 ? 3 : 4
  const target = int(12, 40, rand)
  const r = 1 + Math.max(0.12, 0.6 - level * 0.05)
  const others = shuffle([r, 1 / r, r * r, 1 / (r * r)], rand)
    .slice(0, m - 1)
    .map((f) => Math.round(target * f))
  const counts = shuffle([target, ...others], rand)
  const answer = counts.indexOf(target)
  return {
    type: 'dots',
    target,
    groups: counts.map((c) => scatter(c, rand)),
    answer,
    showMs: Math.max(700, 1600 - level * 80),
    explain: `Group ${answer + 1} had ${target}; the others ${counts.filter((_, i) => i !== answer).join(', ')}`,
  }
}

/** 3 → 4 bars; wrong bars sit at least 25 points away at level 1, 4 points at level 10. */
export function makeBarsItem(level: number, rand: Rand = Math.random): EstItem {
  const m = level < 5 ? 3 : 4
  const gap = Math.max(4, 28 - level * 2.6)
  const target = int(10, 90, rand)
  const right = target + int(-1, 1, rand)
  const values = new Set([right])
  while (values.size < m) {
    const d = Math.round(gap * (1 + rand() * 0.6))
    const up = target + d <= 97 && (target - d < 3 || rand() < 0.5)
    values.add(up ? target + d : target - d)
  }
  const bars = shuffle([...values], rand)
  const answer = bars.indexOf(right)
  return { type: 'bars', target, bars, answer, explain: `Bar ${answer + 1} was ${right}%, the closest to ${target}%` }
}

export const makeEstItem = (n: number, level: number, rand: Rand = Math.random) => (n % 2 ? makeBarsItem(level, rand) : makeDotsItem(level, rand))

function EstimationGame({ level, feedback, onTrial }: GameProps) {
  const [n, setN] = useState(0)
  const [item, setItem] = useState(() => makeEstItem(0, level))
  const [visible, setVisible] = useState(true)
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
    if (item.type !== 'dots') return
    const t = setTimeout(() => setVisible(false), item.showMs)
    return () => clearTimeout(t)
  }, [item])
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(() => {
      setFb(null)
      setVisible(true)
      setItem(makeEstItem(n + 1, levelRef.current))
      setN(n + 1)
    }, fb.ms)
    return () => clearTimeout(t)
  }, [fb, n])

  const count = item.type === 'dots' ? item.groups.length : item.bars.length
  function answer(i: number) {
    if (fb || i >= count) return
    const correct = i === item.answer
    onTrial({ correct, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: item.type })
    setFb({ ok: correct, ms: feedback ? 1200 : 0 })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = Number(e.key)
      if (k >= 1 && k <= 4) answer(k - 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        moveChoiceFocus(choicesRef.current, e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {item.type === 'dots' ? `Which group has about ${item.target} dots?` : `Which bar is roughly ${item.target}%?`}
      </div>
      <div ref={choicesRef} className={item.type === 'dots' ? 'game__choices' : 'rsn-bars'}>
        {item.type === 'dots'
          ? item.groups.map((g, i) => (
              <button key={i} type="button" className="btn game__choice rsn-dots" aria-label={`Group ${i + 1}`} disabled={!!fb} onClick={() => answer(i)}>
                <svg viewBox={`0 0 ${BOX} ${BOX}`} aria-hidden="true">
                  {(visible || (fb && feedback)) && g.map(([x, y], j) => <circle key={j} cx={x} cy={y} r={2.6} fill="currentColor" />)}
                </svg>
                <span className="rsn-key">{i + 1}</span>
              </button>
            ))
          : item.bars.map((v, i) => (
              <button key={i} type="button" className="btn game__choice rsn-hbar" aria-label={`Bar ${i + 1}`} disabled={!!fb} onClick={() => answer(i)}>
                <span className="rsn-key">{i + 1}</span>
                <span className="rsn-hbar__track" aria-hidden="true">
                  <span style={{ width: `${v}%` }} />
                </span>
              </button>
            ))}
      </div>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${item.explain}`}
      </div>
      <div className="game__keys">1–{count} to answer · arrows then Enter</div>
    </div>
  )
}

export const estimation: GameDef = {
  id: 'estimation',
  name: 'Estimation',
  skills: ['estimation', 'numerical-accuracy'],
  howTo: 'Judge quantities at a glance: pick the dot group or bar closest to the number asked, without counting.',
  duration: 120,
  targetRt: 3000,
  Component: EstimationGame satisfies ComponentType<GameProps>,
}
