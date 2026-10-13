import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import type { Op } from './DigitChallenge'
import { shuffle } from './SequenceReasoning'
import './games.css'
import './reasoning.css'
import './aon.css'

type Rand = () => number
export type Bubble = { nums: number[]; ops: Op[]; value: number }
/** 'target': pop every bubble equal to the target. 'ascending': pop all bubbles from smallest to largest. */
export type BubbleRound = { rule: 'target' | 'ascending'; target: number; bubbles: Bubble[] }
export const ROUND_MS = 20000

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
export const bubbleText = (b: Bubble) => b.nums.map((n, i) => `${n}${i < b.ops.length ? ` ${b.ops[i]} ` : ''}`).join('')

/** An expression worth `v` (≥ 2): + and − at level 1, × from 3, two operations from 5, ÷ from 7. */
export function exprFor(v: number, level: number, rand: Rand = Math.random): Bubble {
  const forms = ['add', 'sub', ...(level >= 3 ? ['mul'] : []), ...(level >= 5 ? ['mulAdd'] : []), ...(level >= 7 ? ['div'] : [])]
  const form = forms[Math.floor(rand() * forms.length)]
  const b = (nums: number[], ops: Op[]): Bubble => ({ nums, ops, value: v })
  if (form === 'mul') {
    const f = [...Array(11).keys()].map((k) => k + 2).filter((a) => v % a === 0 && v / a >= 2 && v / a <= 12)
    if (f.length) {
      const a = f[Math.floor(rand() * f.length)]!
      return b([a, v / a], ['×'])
    }
  }
  if (form === 'mulAdd') {
    const [a, c] = [int(2, 9, rand), int(2, 9, rand)]
    const d = v - a * c
    if (d) return b([a, c, Math.abs(d)], ['×', d > 0 ? '+' : '−'])
  }
  if (form === 'div') {
    const d = int(2, 9, rand)
    const q = int(1, Math.min(12, v - 1), rand)
    return b([q * d, d, v - q], ['÷', '+'])
  }
  if (form === 'sub') {
    const s = int(1, 5 + level * 2, rand)
    return b([v + s, s], ['−'])
  }
  const a = int(1, v - 1, rand)
  return b([a, v - a], ['+'])
}

/** 5 bubbles at level 1 up to 8 at 10; targets 2–3 bubbles among near misses; rules alternate by round. */
export function makeBubbleRound(index: number, level: number, rand: Rand = Math.random): BubbleRound {
  const count = 5 + Math.floor((Math.min(10, Math.max(1, level)) - 1) / 3)
  const target = int(8, 14 + level * 3, rand)
  if (index % 2 === 0) {
    const hits = int(2, 3, rand)
    const near = shuffle([-3, -2, -1, 1, 2, 3, 4, -4], rand)
    const values = [...Array(hits).fill(target), ...near.slice(0, count - hits).map((d) => target + d)]
    return { rule: 'target', target, bubbles: shuffle(values.map((v) => exprFor(v, level, rand)), rand) }
  }
  const values = new Set<number>()
  while (values.size < count) values.add(int(Math.max(3, target - 6 - level), target + 6 + level, rand))
  return { rule: 'ascending', target, bubbles: shuffle([...values].map((v) => exprFor(v, level, rand)), rand) }
}

/** Whether popping bubble i is right, given the bubbles already popped. */
export function isRightPop(round: BubbleRound, popped: number[], i: number) {
  const b = round.bubbles[i]!
  if (round.rule === 'target') return b.value === round.target
  return round.bubbles.every((x, j) => j === i || popped.includes(j) || x.value >= b.value)
}
/** Indices still to pop for the round to be complete. */
export const remaining = (round: BubbleRound, popped: number[]) =>
  round.bubbles.flatMap((b, i) => (!popped.includes(i) && (round.rule === 'ascending' || b.value === round.target) ? [i] : []))

/** Stars per correct pop: 1, rising by one every 3 in a row, to 5. */
export const starsFor = (streak: number) => Math.min(5, 1 + Math.floor(Math.max(0, streak - 1) / 3))

/** Trials in order: kind 'pop' (right or wrong) and 'miss' (left when time ran out); misses and wrong pops break the streak. */
export function numbubblesDetails(trials: Trial[]) {
  let [streak, best, points] = [0, 0, 0]
  for (const t of trials) {
    if (t.kind === 'pop' && t.correct) {
      streak++
      best = Math.max(best, streak)
      points += starsFor(streak)
    } else streak = 0
  }
  const pops = trials.filter((t) => t.kind === 'pop')
  return { popAccuracy: pops.length ? Math.round((pops.filter((t) => t.correct).length / pops.length) * 1000) / 1000 : 0, bestStreak: best, points }
}

// Fixed float slots (percent of the arena), shuffled per round so bubbles never overlap.
const SLOTS = [
  [12, 22], [38, 14], [64, 22], [88, 16], [20, 58], [46, 50], [72, 60], [90, 70], [30, 86], [60, 88],
] as const

function NumbubblesGame({ level, mode, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [idx, setIdx] = useState(0)
  const [round, setRound] = useState(() => makeBubbleRound(0, level))
  const [slots, setSlots] = useState(() => shuffle([...SLOTS.keys()], Math.random))
  const [popped, setPopped] = useState<number[]>([])
  const [wrong, setWrong] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [points, setPoints] = useState(0)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [between, setBetween] = useState(false)
  const lastAt = useRef(performance.now())
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  function endRound(timedOut: boolean) {
    if (timedOut) remaining(round, popped).forEach(() => onTrial({ correct: false, rt: ROUND_MS, level: itemLevel.current, kind: 'miss' }))
    if (timedOut) setStreak(0)
    if (r.count()) return
    setBetween(true)
    setMsg(timedOut ? { ok: false, text: 'Time is up for this round' } : { ok: true, text: 'Round cleared' })
  }
  const endRef = useRef(endRound)
  useEffect(() => {
    endRef.current = endRound
  })
  useEffect(() => {
    if (between) {
      const t = setTimeout(() => {
        itemLevel.current = levelRef.current
        setIdx(idx + 1)
        setRound(makeBubbleRound(idx + 1, levelRef.current))
        setSlots(shuffle([...SLOTS.keys()], Math.random))
        setPopped([])
        setMsg(null)
        setBetween(false)
        lastAt.current = performance.now()
      }, 900)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => endRef.current(true), ROUND_MS)
    return () => clearTimeout(t)
  }, [round, between, idx])
  useEffect(() => {
    if (wrong === null) return
    const t = setTimeout(() => setWrong(null), 400)
    return () => clearTimeout(t)
  }, [wrong])

  function pop(i: number) {
    if (between || popped.includes(i) || i >= round.bubbles.length) return
    const ok = isRightPop(round, popped, i)
    const now = performance.now()
    onTrial({ correct: ok, rt: now - lastAt.current, level: itemLevel.current, kind: 'pop' })
    lastAt.current = now
    if (!ok) {
      setStreak(0)
      setWrong(i)
      const v = round.bubbles[i]!.value
      if (feedback) setMsg({ ok: false, text: round.rule === 'target' ? `That one is ${v}, not ${round.target}` : `${v} is not the smallest left` })
      return
    }
    setStreak(streak + 1)
    setPoints(points + starsFor(streak + 1))
    setMsg(null)
    const p = [...popped, i]
    setPopped(p)
    if (!remaining(round, p).length) endRound(false)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = Number(e.key)
      if (k >= 1 && k <= 9) pop(k - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const stars = starsFor(streak)
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {round.rule === 'target' ? (
          <>
            Pop every bubble equal to <strong className="aon-target tnum">{round.target}</strong>
          </>
        ) : (
          'Pop all the bubbles from smallest to largest'
        )}
      </div>
      <div key={idx} className="rsn-timer" style={{ '--timer-ms': `${ROUND_MS}ms`, animationPlayState: between ? 'paused' : 'running' } as CSSProperties} aria-hidden="true" />
      <div className="aon-bubbles">
        {round.bubbles.map((b, i) => {
          const [x, y] = SLOTS[slots[i]!]!
          return (
            !popped.includes(i) && (
              <button key={i} type="button" className="aon-bubble" data-wrong={wrong === i ? 'true' : undefined} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${-i * 0.7}s` }} disabled={between} onClick={() => pop(i)}>
                <span className="rsn-key">{i + 1}</span>
                <span className="tnum">{bubbleText(b)}</span>
              </button>
            )
          )
        })}
      </div>
      <div className="game__prompt tnum" aria-label={`${stars} stars per pop, ${points} points`}>
        {'★'.repeat(stars)}
        <span className="rsn-muted">{'☆'.repeat(5 - stars)}</span> · {points} points · round {idx + 1}
      </div>
      <div className={`game__feedback ${msg ? (msg.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {msg?.text}
      </div>
      <div className="game__keys">Tap a bubble or press its number</div>
    </div>
  )
}

export const numbubbles: GameDef = {
  id: 'numbubbles',
  name: 'Numbubbles',
  skills: ['numerical-speed'],
  howTo: 'Work out each bubble’s sum and pop the right ones fast: a run of right pops earns up to five stars each.',
  duration: 200,
  targetRt: 2500,
  Component: NumbubblesGame satisfies ComponentType<GameProps>,
  details: numbubblesDetails,
}
