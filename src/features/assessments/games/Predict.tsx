import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './arctic.css'
import { shuffle } from './SequenceReasoning'

type Rand = () => number
export type Weather = 'sun' | 'rain'

/** P(sun) carried by each of the 4 cards: two strong and two weak cues, ±0.36 from even at level 1 down to ±0.09 at 10. */
export function makeCues(level: number, rand: Rand = Math.random): number[] {
  const s = 0.36 - (Math.min(10, Math.max(1, level)) - 1) * 0.03
  return shuffle([0.5 + s, 0.5 + s / 2, 0.5 - s / 2, 0.5 - s], rand)
}

/** P(sun | the shown cards), combining each card's odds independently from an even prior. */
export function posterior(cues: number[], shown: number[]) {
  const odds = shown.reduce((o, i) => o * (cues[i]! / (1 - cues[i]!)), 1)
  return odds / (1 + odds)
}

/** 1–4 distinct cards; patterns whose cues cancel to 50/50 are skipped, so every pattern has one best forecast. */
export function makePattern(cues: number[], rand: Rand = Math.random): number[] {
  for (;;) {
    const shown = cues.map((_, i) => i).filter(() => rand() < 0.5)
    if (shown.length && Math.abs(posterior(cues, shown) - 0.5) > 0.01) return shown
  }
}

export const bestForecast = (cues: number[], shown: number[]): Weather => (posterior(cues, shown) > 0.5 ? 'sun' : 'rain')
export const drawWeather = (cues: number[], shown: number[], rand: Rand = Math.random): Weather => (rand() < posterior(cues, shown) ? 'sun' : 'rain')

/** Optimal-forecast rate overall and over the later half, once the cues could have been learned. */
export function predictDetails(trials: Trial[]) {
  const f = trials.filter((t) => t.kind === 'forecast')
  const rate = (xs: Trial[]) => (xs.length ? Math.round((xs.filter((t) => t.correct).length / xs.length) * 1000) / 1000 : 0)
  return { optimalRate: rate(f), lateOptimalRate: rate(f.slice(Math.floor(f.length / 2))) }
}

const SYMBOLS = ['circle', 'triangle', 'square', 'cross'] as const
function CueSymbol({ i }: { i: number }) {
  const s = SYMBOLS[i]
  return (
    <svg viewBox="0 0 40 40" className="arc-symbol" aria-hidden="true">
      {s === 'circle' && <circle cx="20" cy="20" r="13" />}
      {s === 'triangle' && <polygon points="20,6 34,32 6,32" />}
      {s === 'square' && <rect x="8" y="8" width="24" height="24" />}
      {s === 'cross' && <path d="M15 6h10v9h9v10h-9v9H15v-9H6V15h9z" />}
    </svg>
  )
}

function PredictGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  // ponytail: the cue set is fixed at mount, as learning needs; later level changes only take effect on the next game.
  const [cues] = useState(() => makeCues(level))
  // The cues are this level's, so every trial reports it, whatever the session's level does next.
  const [cueLevel] = useState(level)
  const [shown, setShown] = useState(() => makePattern(cues))
  const [fb, setFb] = useState<{ ok: boolean; weather: Weather; best: Weather; p: number } | null>(null)
  const [score, setScore] = useState(0)
  const done = useRef(0)
  const shownAt = useRef(0)
  useEffect(() => {
    shownAt.current = performance.now()
  }, [shown])
  useEffect(() => {
    if (!fb) return
    const t = setTimeout(
      () => {
        setFb(null)
        setShown(makePattern(cues))
      },
      feedback ? 1600 : 1000,
    )
    return () => clearTimeout(t)
  }, [fb, feedback, cues])

  function forecast(w: Weather) {
    if (fb) return
    const best = bestForecast(cues, shown)
    const weather = drawWeather(cues, shown)
    onTrial({ correct: w === best, rt: performance.now() - shownAt.current, level: cueLevel, kind: 'forecast' })
    if (w === weather) setScore((s) => s + 1)
    setFb({ ok: w === best, weather, best, p: posterior(cues, shown) })
    if (rounds && ++done.current >= rounds) onDone?.()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowLeft' || e.key === '1') forecast('sun')
      else if (e.key === 'r' || e.key === 'R' || e.key === 'ArrowRight' || e.key === '2') forecast('rain')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Learn what the cards mean: will it be sun or rain?
      </div>
      <div className="arc-cards" role="img" aria-label={`Cards: ${shown.map((i) => SYMBOLS[i]).join(', ')}`}>
        {shown.map((i) => (
          <span key={i} className="arc-card">
            <CueSymbol i={i} />
          </span>
        ))}
      </div>
      <div className="game__choices">
        <button type="button" className="btn game__choice" disabled={!!fb} onClick={() => forecast('sun')}>
          <span className="rsn-key">S</span> ☀ Sun
        </button>
        <button type="button" className="btn game__choice" disabled={!!fb} onClick={() => forecast('rain')}>
          <span className="rsn-key">R</span> ☂ Rain
        </button>
      </div>
      <div className="game__prompt arc-tally" aria-live="polite">
        {fb ? `It was ${fb.weather === 'sun' ? '☀ sun' : '☂ rain'}` : ' '} · Right {score}
      </div>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb &&
          feedback &&
          `${fb.ok ? 'Best call' : 'Not the best call'}: these cards mean ${Math.round((fb.best === 'sun' ? fb.p : 1 - fb.p) * 100)}% ${fb.best}`}
      </div>
      <div className="game__keys">S or ← for sun · R or → for rain</div>
    </div>
  )
}

export const predict: GameDef = {
  id: 'predict',
  name: 'Predict',
  skills: ['probabilistic-reasoning'],
  howTo: 'Each card makes sun or rain more likely; forecast the weather and learn from the outcomes which cards to trust.',
  duration: 240,
  targetRt: 2500,
  Component: PredictGame satisfies ComponentType<GameProps>,
  details: predictDetails,
}
