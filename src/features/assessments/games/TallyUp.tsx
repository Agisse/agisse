import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import './games.css'
import './reasoning.css'
import './aon.css'

type Rand = () => number
export type Token = { side: 0 | 1; value: 1 | 2 | 4; mod: 'double' | 'negate' | null }
export type TallyItem = { tokens: Token[]; showMs: number }
export const ANSWER_MS = 4000

export const tokenValue = (t: Token) => t.value * (t.mod === 'double' ? 2 : 1) * (t.mod === 'negate' ? -1 : 1)
export const totals = (item: TallyItem) => item.tokens.reduce<[number, number]>((s, t) => ((s[t.side] += tokenValue(t)), s), [0, 0])
export const winner = (item: TallyItem): 0 | 1 => (totals(item)[0] > totals(item)[1] ? 0 : 1)

/** 4 tokens at 900 ms each (level 1) to 10 at 450 ms (level 10); ×2 and − modifiers from level 3, rising to 37%; never a tie. */
export function makeTallyItem(level: number, rand: Rand = Math.random): TallyItem {
  const L = Math.min(10, Math.max(1, level))
  const n = 4 + Math.floor(L * 0.6)
  const modP = L <= 2 ? 0 : 0.1 + L * 0.027
  for (;;) {
    const tokens = Array.from({ length: n }, (): Token => {
      const m = rand() < modP ? (rand() < 0.5 ? 'double' : 'negate') : null
      return { side: rand() < 0.5 ? 0 : 1, value: ([1, 2, 4] as const)[Math.floor(rand() * 3)]!, mod: m }
    })
    const item = { tokens, showMs: Math.round(900 - (L - 1) * 50) }
    const [a, b] = totals(item)
    if (a !== b) return item
  }
}

/** kind 'mod' (round had a modifier) | 'plain', or 'timeout'. */
export function tallyDetails(trials: Trial[]) {
  const acc = (k: string) => {
    const xs = trials.filter((t) => t.kind === k)
    return xs.length ? Math.round((xs.filter((t) => t.correct).length / xs.length) * 1000) / 1000 : 0
  }
  return { plainAccuracy: acc('plain'), modifierAccuracy: acc('mod'), timeouts: trials.filter((t) => t.kind === 'timeout').length }
}

const label = (t: Token) => `${t.mod === 'negate' ? '−' : ''}${t.value}${t.mod === 'double' ? ' ×2' : ''}`
type Phase = { name: 'show'; i: number; gap: boolean } | { name: 'answer' } | { name: 'fb'; ok: boolean; text: string }

function TallyUpGame({ level, mode, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [item, setItem] = useState(() => makeTallyItem(level))
  const [phase, setPhase] = useState<Phase>({ name: 'show', i: 0, gap: true })
  const askedAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  const [L, R] = totals(item)
  const explain = `Left ${L}, right ${R}`

  useEffect(() => {
    if (phase.name === 'show') {
      const t = setTimeout(
        () => {
          if (phase.gap) return setPhase({ ...phase, gap: false })
          setPhase(phase.i + 1 < item.tokens.length ? { name: 'show', i: phase.i + 1, gap: true } : { name: 'answer' })
        },
        phase.gap ? 150 : item.showMs,
      )
      return () => clearTimeout(t)
    }
    if (phase.name === 'answer') {
      askedAt.current = performance.now()
      const t = setTimeout(() => settle(null), ANSWER_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(
      () => {
        itemLevel.current = levelRef.current
        setItem(makeTallyItem(levelRef.current))
        setPhase({ name: 'show', i: 0, gap: true })
      },
      feedback ? 1300 : 300,
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function settle(side: 0 | 1 | null) {
    if (phase.name !== 'answer') return
    const ok = side === winner(item)
    const kind = side === null ? 'timeout' : item.tokens.some((t) => t.mod) ? 'mod' : 'plain'
    onTrial({ correct: ok, rt: side === null ? ANSWER_MS : performance.now() - askedAt.current, level: itemLevel.current, kind })
    if (!r.count()) setPhase({ name: 'fb', ok, text: side === null ? `Time ran out: ${explain}` : explain })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowLeft') settle(0)
      else if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowRight') settle(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const tok = phase.name === 'show' && !phase.gap ? item.tokens[phase.i]! : null
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {phase.name === 'answer' ? 'Which side has the bigger total?' : phase.name === 'show' ? 'Keep a running total for each side' : 'Next round…'}
      </div>
      {phase.name === 'answer' && <div className="rsn-timer" style={{ '--timer-ms': `${ANSWER_MS}ms` } as CSSProperties} aria-hidden="true" />}
      <div className="aon-tally">
        {([0, 1] as const).map((side) => (
          <button key={side} type="button" className="btn aon-tally__side" disabled={phase.name !== 'answer'} onClick={() => settle(side)} aria-label={side ? 'Right side' : 'Left side'}>
            {tok && tok.side === side && (
              <span className="aon-token" data-mod={tok.mod ?? undefined} aria-label={label(tok)}>
                {tok.mod === 'negate' ? '−' : ''}
                {tok.value}
                {tok.mod === 'double' && <small>×2</small>}
              </span>
            )}
            {phase.name === 'answer' && <span className="rsn-key">{side ? 'J or →' : 'F or ←'}</span>}
          </button>
        ))}
      </div>
      <div className="game__prompt rsn-muted" aria-live="polite">
        {tok ? `${tok.side ? 'Right' : 'Left'}: ${label(tok)}` : ''}
      </div>
      <div className={`game__feedback ${phase.name === 'fb' && feedback ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {phase.name === 'fb' && feedback && `${phase.ok ? 'Right' : 'Not quite'}: ${phase.text}`}
      </div>
      <div className="game__keys">Tokens are worth 1, 2 or 4 · ×2 doubles a token · − takes it away · F/← left, J/→ right</div>
    </div>
  )
}

export const tallyUp: GameDef = {
  id: 'tally-up',
  name: 'Tally Up',
  skills: ['working-memory', 'numerical-speed'],
  howTo: 'Tokens appear one at a time on the left or right; keep both totals in your head and pick the bigger side.',
  duration: 140,
  targetRt: 1500,
  Component: TallyUpGame satisfies ComponentType<GameProps>,
  details: tallyDetails,
}
