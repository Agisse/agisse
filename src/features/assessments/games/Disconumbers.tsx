import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './hirevue.css'

type Rand = () => number
/** circles: the number on each circle; seq: circle indices in lighting order; options: 4 sums, one right. */
export type DiscoRound = { circles: number[]; seq: number[]; options: number[]; stepMs: number; hide: boolean; moving: boolean }

export const KEYS = 'ABCDEFGHIJ'

/** Circles 6 → 10, sequence 3 → 7, 800 → 500 ms per light; numbers hide from level 4, circles move from level 6. */
export function makeDiscoRound(level: number, rand: Rand = Math.random): DiscoRound {
  const n = 6 + Math.floor((level - 1) / 2)
  const len = Math.min(n, 3 + Math.floor((level - 1) / 2.25))
  const circles = Array.from({ length: n }, () => 1 + Math.floor(rand() * 9))
  const seq: number[] = []
  while (seq.length < len) {
    const c = Math.floor(rand() * n)
    if (!seq.includes(c)) seq.push(c)
  }
  const sum = seq.reduce((s, c) => s + circles[c], 0)
  const options = new Set([sum])
  while (options.size < 4) {
    const d = sum + (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 5))
    if (d > 0) options.add(d)
  }
  return { circles, seq, options: [...options].sort((a, b) => a - b), stepMs: Math.round(800 - (level - 1) * 33), hide: level >= 4, moving: level >= 6 }
}

export const sumOf = (r: DiscoRound) => r.seq.reduce((s, c) => s + r.circles[c], 0)
export const orderRight = (r: DiscoRound, taps: number[]) => taps.length === r.seq.length && taps.every((c, i) => c === r.seq[i])
/** kind = 'o1s0': order right, sum wrong. Correct needs both. */
export const discoKind = (order: boolean, sum: boolean) => `o${+order}s${+sum}`

export function discoDetails(trials: Trial[]) {
  const ks = trials.filter((t) => /^o[01]s[01]$/.test(t.kind ?? ''))
  if (!ks.length) return { orderRate: 0, sumRate: 0 }
  const rate = (re: RegExp) => Math.round((ks.filter((t) => re.test(t.kind!)).length / ks.length) * 1000) / 1000
  return { orderRate: rate(/^o1/), sumRate: rate(/s1$/) }
}

type Phase = { name: 'show'; i: number; blank: boolean } | { name: 'tap' } | { name: 'sum'; order: boolean } | { name: 'fb'; ok: boolean; text: string }

function DisconumbersGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [round, setRound] = useState(() => makeDiscoRound(level))
  const [phase, setPhase] = useState<Phase>({ name: 'show', i: 0, blank: true })
  const [taps, setTaps] = useState<number[]>([])
  const startAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  const played = useRef(0)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    itemLevel.current = levelRef.current
  }, [round])

  useEffect(() => {
    if (phase.name === 'show') {
      const t = setTimeout(
        () => {
          if (phase.blank) return setPhase({ name: 'show', i: phase.i, blank: false })
          if (phase.i + 1 < round.seq.length) return setPhase({ name: 'show', i: phase.i + 1, blank: true })
          startAt.current = performance.now()
          setPhase({ name: 'tap' })
        },
        phase.blank ? 250 : round.stepMs,
      )
      return () => clearTimeout(t)
    }
    if (phase.name === 'fb') {
      const t = setTimeout(
        () => {
          setTaps([])
          setRound(makeDiscoRound(levelRef.current))
          setPhase({ name: 'show', i: 0, blank: true })
        },
        feedback ? 1600 : 300,
      )
      return () => clearTimeout(t)
    }
  }, [phase, round, feedback])

  function tap(c: number) {
    if (phase.name !== 'tap') return
    const next = [...taps, c]
    setTaps(next)
    if (next.length === round.seq.length) setPhase({ name: 'sum', order: orderRight(round, next) })
  }
  function answer(v: number) {
    if (phase.name !== 'sum') return
    const sum = v === sumOf(round)
    const ok = phase.order && sum
    onTrial({ correct: ok, rt: performance.now() - startAt.current, level: itemLevel.current, kind: discoKind(phase.order, sum) })
    if (rounds && ++played.current >= rounds) onDone?.()
    const order = round.seq.map((c) => KEYS[c]).join(' ')
    const text = `order ${order}${phase.order ? ' ✓' : ''}, sum ${round.seq.map((c) => round.circles[c]).join(' + ')} = ${sumOf(round)}`
    setPhase({ name: 'fb', ok, text })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key.length !== 1) return
      const c = KEYS.indexOf(e.key.toUpperCase())
      if (phase.name === 'tap' && c >= 0 && c < round.circles.length) tap(c)
      const o = Number(e.key) - 1
      if (phase.name === 'sum' && o >= 0 && o < 4) answer(round.options[o])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const lit = phase.name === 'show' && !phase.blank ? round.seq[phase.i] : -1
  const n = round.circles.length
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {phase.name === 'show'
          ? 'Watch the order the circles light up'
          : phase.name === 'tap'
            ? `Tap the circles in the same order (${taps.length}/${round.seq.length})`
            : phase.name === 'sum'
              ? 'What do the lit numbers add up to?'
              : 'Next round…'}
      </div>
      <div className="hv-disco" data-moving={round.moving}>
        {round.circles.map((v, c) => {
          const a = (2 * Math.PI * c) / n - Math.PI / 2
          const style = { left: `${50 + 38 * Math.cos(a)}%`, top: `${50 + 38 * Math.sin(a)}%`, '--hv-hue': (c * 360) / n, '--hv-delay': `${-c * 0.7}s` } as CSSProperties
          const showNum = !round.hide || c === lit || (phase.name === 'fb' && feedback)
          return (
            <button
              key={c}
              type="button"
              className="hv-disc"
              style={style}
              data-lit={c === lit}
              aria-pressed={phase.name !== 'show' ? taps.includes(c) : undefined}
              aria-label={`Circle ${KEYS[c]}${showNum ? `, ${v}` : ''}`}
              disabled={phase.name !== 'tap'}
              onClick={() => tap(c)}
            >
              <span className="hv-disc__num">{showNum ? v : ''}</span>
              <span className="hv-key hv-disc__key">{KEYS[c]}</span>
            </button>
          )
        })}
      </div>
      {phase.name === 'sum' && (
        <div className="game__choices">
          {round.options.map((v, i) => (
            <button key={v} type="button" className="btn game__choice" onClick={() => answer(v)}>
              <span className="hv-key">{i + 1}</span> {v}
            </button>
          ))}
        </div>
      )}
      <div className={`game__feedback ${phase.name === 'fb' && feedback ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {phase.name === 'fb' && feedback && `${phase.ok ? 'Right' : 'Not quite'}: ${phase.text}`}
      </div>
      <div className="game__keys">Letter keys tap a circle · 1–4 pick the sum</div>
    </div>
  )
}

export const disconumbers: GameDef = {
  id: 'disconumbers',
  name: 'Disconumbers',
  skills: ['working-memory', 'numerical-speed'],
  howTo: 'Numbered circles light up one by one: tap them back in the same order, then pick what the lit numbers add up to.',
  duration: 180,
  targetRt: 6000,
  Component: DisconumbersGame satisfies ComponentType<GameProps>,
  details: discoDetails,
}
