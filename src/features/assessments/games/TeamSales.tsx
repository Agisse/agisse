import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './arctic.css'

type Rand = () => number
/** H = keep the price high (cooperate), L = undercut (defect). */
export type Move = 'H' | 'L'
export type Rival = 'tft' | 'grim'
/** Points for [you, rival], keyed by your move then theirs: an iterated prisoner's dilemma. */
export const PAYOFF: Record<`${Move}${Move}`, [number, number]> = { HH: [3, 3], HL: [0, 5], LH: [5, 0], LL: [1, 1] }
export const GAME_ROUNDS = 12

export const pickRival = (rand: Rand = Math.random): Rival => (rand() < 0.5 ? 'tft' : 'grim')
/** Chance tit-for-tat misplays: 4% at level 1 up to 17.5% at 10. */
export const noiseFor = (level: number) => 0.04 + (Math.min(10, Math.max(1, level)) - 1) * 0.015

/** Grim stays high until you undercut once, then never forgives; tit-for-tat copies your last move, sometimes flipped. */
export function rivalMove(rival: Rival, mine: Move[], noise: number, rand: Rand = Math.random): Move {
  if (rival === 'grim') return mine.includes('L') ? 'L' : 'H'
  const copy = mine.at(-1) ?? 'H'
  return rand() < noise ? (copy === 'H' ? 'L' : 'H') : copy
}

/**
 * Keep prices high unless the rival undercut in each of the last two rounds. On the final round nothing is left to
 * protect: the rival can't answer, so Low pays more whatever they do.
 */
export const bestMove = (theirs: Move[], last = false): Move => (last || theirs.slice(-2).join('') === 'LL' ? 'L' : 'H')

/** kind = '<your move>:<rival's last two moves>', e.g. 'L:HL'. */
export const salesKind = (me: Move, theirs: Move[]) => `${me}:${theirs.slice(-2).join('')}`

/** Cooperation = share of High; retaliation = Low right after the rival's Low; forgiveness = High once the rival is back to High after a Low. */
export function teamSalesDetails(trials: Trial[]) {
  const ks = trials.map((t) => t.kind ?? '').filter((k) => /^[HL]:[HL]{0,2}$/.test(k))
  const rate = (xs: string[]) => (xs.length ? Math.round((xs.filter((k) => k[0] === 'H').length / xs.length) * 1000) / 1000 : 0)
  const afterL = ks.filter((k) => k.endsWith('L'))
  return {
    cooperationRate: rate(ks),
    retaliationRate: afterL.length ? Math.round((1 - rate(afterL)) * 1000) / 1000 : 0,
    forgivenessRate: rate(ks.filter((k) => k.endsWith('LH'))),
  }
}

const NAME: Record<Move, string> = { H: 'High', L: 'Low' }

function TeamSalesGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [rival, setRival] = useState(() => pickRival())
  const [hist, setHist] = useState<{ me: Move; them: Move }[]>([])
  const [totals, setTotals] = useState<[number, number]>([0, 0])
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const done = useRef(0)
  const shownAt = useRef(0)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    shownAt.current = performance.now()
  }, [hist])
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(() => setFb(null), feedback ? 1600 : 600)
    return () => clearTimeout(t)
  }, [fb, feedback])

  function choose(me: Move) {
    if (fb || (rounds && done.current >= rounds)) return
    // Practice: a fresh rival every 12 rounds.
    const fresh = hist.length >= GAME_ROUNDS
    const past = fresh ? [] : hist
    const r = fresh ? pickRival() : rival
    if (fresh) setRival(r)
    const theirs = past.map((h) => h.them)
    const them = rivalMove(r, past.map((h) => h.me), noiseFor(levelRef.current))
    const best = bestMove(theirs, past.length === GAME_ROUNDS - 1)
    onTrial({ correct: me === best, rt: performance.now() - shownAt.current, level: levelRef.current, kind: salesKind(me, theirs) })
    const [a, b] = PAYOFF[`${me}${them}`]
    setTotals(([x, y]) => (fresh ? [a, b] : [x + a, y + b]))
    setHist([...past, { me, them }])
    setFb({
      ok: me === best,
      text: `Rival went ${NAME[them]}. ${best === 'H' ? 'Best here: High, since mutual High pays most over time' : past.length === GAME_ROUNDS - 1 ? 'Best here: Low, the last round, so the rival can no longer answer it' : 'Best here: Low, the rival undercut twice in a row'}`,
    })
    if (rounds && ++done.current >= rounds) onDone?.()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === '1' || e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'H') choose('H')
      else if (e.key === '2' || e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') choose('L')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const last = hist.at(-1)
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Round {(hist.length % GAME_ROUNDS) + (fb ? 0 : 1) || GAME_ROUNDS} of {GAME_ROUNDS}: set your price. Your rival sets theirs at the same time.
      </div>
      <table className="arc-matrix">
        <caption className="rsn-muted">Points (you / rival)</caption>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Rival High</th>
            <th scope="col">Rival Low</th>
          </tr>
        </thead>
        <tbody>
          {(['H', 'L'] as const).map((m) => (
            <tr key={m}>
              <th scope="row">You {NAME[m]}</th>
              {(['H', 'L'] as const).map((t) => (
                <td key={t} data-on={!!fb && last?.me === m && last.them === t}>
                  {PAYOFF[`${m}${t}`].join(' / ')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="game__choices">
        <button type="button" className="btn game__choice" disabled={!!fb} onClick={() => choose('H')}>
          <span className="rsn-key">1</span> High price
        </button>
        <button type="button" className="btn game__choice" disabled={!!fb} onClick={() => choose('L')}>
          <span className="rsn-key">2</span> Low price
        </button>
      </div>
      <ol className="arc-history" aria-label="Rounds so far">
        {hist.map((h, i) => (
          <li key={i} title={`You ${NAME[h.me]}, rival ${NAME[h.them]}`}>
            <span data-move={h.me}>{h.me}</span>
            <span data-move={h.them}>{h.them}</span>
          </li>
        ))}
      </ol>
      <div className="game__prompt arc-tally" aria-live="polite">
        {last ? `You ${NAME[last.me]}, rival ${NAME[last.them]} · ` : ''}You {totals[0]} · Rival {totals[1]}
      </div>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && fb.text}
      </div>
      <div className="game__keys">1 or ← for High · 2 or → for Low</div>
    </div>
  )
}

export const teamSales: GameDef = {
  id: 'team-sales',
  name: 'Team Sales',
  skills: ['probabilistic-reasoning'],
  howTo: 'Each round, set a High or Low price against a rival who reacts to what you did; aim for the most points over all rounds.',
  duration: 120,
  targetRt: 3000,
  Component: TeamSalesGame satisfies ComponentType<GameProps>,
  details: teamSalesDetails,
}
