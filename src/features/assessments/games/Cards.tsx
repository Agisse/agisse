import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { shuffle } from './SequenceReasoning'
import './games.css'
import './pymetrics.css'

type Rand = () => number
export type Deck = 'A' | 'B' | 'C' | 'D'
export const DECKS: Deck[] = ['A', 'B', 'C', 'D']
export const isGood = (d: Deck) => d === 'C' || d === 'D'
const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))

/**
 * The classic Iowa schedule as odds. A and B pay 100, C and D pay 50. A loses 150–350 half the time, B loses 1250 one
 * time in ten, C loses 25–75 half the time, D loses 250 one time in ten: per ten cards A and B net −250, C and D +250.
 */
export function drawCard(deck: Deck, rand: Rand = Math.random) {
  const win = deck === 'A' || deck === 'B' ? 100 : 50
  const r = rand()
  const loss = deck === 'A' ? (r < 0.5 ? 50 * int(3, 7, rand) : 0) : deck === 'B' ? (r < 0.1 ? 1250 : 0) : deck === 'C' ? (r < 0.5 ? 25 * int(1, 3, rand) : 0) : r < 0.1 ? 250 : 0
  return { win, loss }
}
/** Energy generators reshuffle their positions every ~10 activations: 14 at level 1 down to 5 at level 10. */
export const shuffleEvery = (level: number) => Math.max(5, 15 - level)
/** Energy pays a fifth of the Iowa amounts, so every value stays whole. */
export const ENERGY_DIV = 5

/** kind = 'deck:<A–D>'. Late phase = the second half of the draws. */
export function cardsDetails(trials: Trial[]) {
  const picks = trials.filter((t) => t.kind?.startsWith('deck:'))
  const rate = (ts: Trial[]) => (ts.length ? Math.round((ts.filter((t) => t.correct).length / ts.length) * 1000) / 1000 : 0)
  return { goodDeckRate: rate(picks), lateGoodDeckRate: rate(picks.slice(picks.length >> 1)) }
}

const GENERATOR_COLOURS = ['green', 'blue', 'orange', 'purple'] as const

function CardsGame({ level, feedback, onTrial, variant, rounds, onDone }: GameProps) {
  const energy = variant === 'energy'
  const unit = (n: number) => (energy ? `${n / ENERGY_DIV} energy` : `$${n}`)
  // Deck letters are hidden: which slot holds which deck is drawn per session (and reshuffled often in Energy).
  const [order, setOrder] = useState<Deck[]>(() => shuffle([...DECKS], Math.random))
  const [colourOf] = useState(() => {
    const c = shuffle([...GENERATOR_COLOURS], Math.random)
    return (d: Deck) => c[DECKS.indexOf(d)]!
  })
  const [total, setTotal] = useState(2000)
  const [last, setLast] = useState<{ slot: number; win: number; loss: number; good: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const shownAt = useRef(performance.now())
  const played = useRef(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  function pick(slot: number) {
    if (busy) return
    const deck = order[slot]!
    const { win, loss } = drawCard(deck)
    onTrial({ correct: isGood(deck), rt: performance.now() - shownAt.current, level, kind: `deck:${deck}` })
    setTotal((t) => t + win - loss)
    setLast({ slot, win, loss, good: isGood(deck) })
    setBusy(true)
  }

  useEffect(() => {
    if (!busy) return
    const t = setTimeout(() => {
      played.current++
      if (rounds && played.current >= rounds) return doneRef.current?.()
      if (energy && played.current % shuffleEvery(level) === 0) {
        setOrder((o) => shuffle([...o], Math.random))
        setLast((l) => l && { ...l, slot: -1 })
      }
      setBusy(false)
      shownAt.current = performance.now()
    }, feedback ? 1000 : 600)
    return () => clearTimeout(t)
  }, [busy, rounds, energy, level, feedback])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const i = ['1', '2', '3', '4'].indexOf(e.key)
      if (i >= 0) pick(i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const name = energy ? 'generator' : 'deck'
  return (
    <div className="game">
      <div className="game__prompt">
        {energy ? 'Activate a generator. Each one gains or drains energy on its own odds; they move, so track them by colour.' : 'Draw from any deck. Some decks pay more now and cost more later.'}
      </div>
      <div className="pym-tally game__stimulus" aria-live="polite">
        {energy ? `${total / ENERGY_DIV} energy` : `$${total}`}
      </div>
      <div className="pym-decks">
        {order.map((d, i) => (
          <button
            key={energy ? d : i}
            type="button"
            className={`btn pym-deck ${energy ? 'pym-deck--gen' : ''}`}
            data-colour={energy ? colourOf(d) : undefined}
            data-picked={last?.slot === i}
            disabled={busy}
            onClick={() => pick(i)}
            aria-label={`${energy ? `${colourOf(d)} generator` : `Deck ${'ABCD'[i]}`} (key ${i + 1})`}
          >
            <span className="pym-key">{i + 1}</span>
            <span className="pym-deck__name" aria-hidden="true">
              {energy ? (
                <>
                  <span className="pym-deck__bolt">⚡</span>
                  {colourOf(d)}
                </>
              ) : (
                'ABCD'[i]
              )}
            </span>
          </button>
        ))}
      </div>
      <div className={`game__feedback ${last && feedback ? (last.good ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {last &&
          `${energy ? 'Gained' : 'Won'} ${unit(last.win)}${last.loss ? `, ${energy ? 'drained' : 'lost'} ${unit(last.loss)}` : ''}` +
            (feedback ? ` · ${last.good ? `a steady ${name}: smaller gains, small losses` : `a risky ${name}: big gains, bigger losses over time`}` : '')}
      </div>
      <div className="game__keys">1–4 or tap to pick a {name}</div>
    </div>
  )
}

export const cards: GameDef = {
  id: 'cards',
  name: 'Cards',
  skills: ['probabilistic-reasoning'],
  howTo: 'Pick from four decks to grow your money. Each deck has its own wins and losses; find the ones that pay over time.',
  duration: 240,
  targetRt: 2000,
  Component: CardsGame satisfies ComponentType<GameProps>,
  details: cardsDetails,
}
