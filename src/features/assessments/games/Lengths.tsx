import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './pymetrics.css'

type Rand = () => number
export type Len = 'short' | 'long'
/** Correct answers on the rich length are rewarded 3× as often as on the lean one. */
export const RICH_P = 0.6
export const LEAN_P = 0.2
export const FLASH_MS = 100
export const SHORT_W = 60

/** How much longer the long mouth is, in %: 20 at level 1 down to 4 at level 10. */
export const diffPct = (level: number) => Math.round(20 - ((Math.min(10, Math.max(1, level)) - 1) * 16) / 9)
export const mouthWidth = (len: Len, level: number) => (len === 'short' ? SHORT_W : SHORT_W * (1 + diffPct(level) / 100))
export const makeLength = (rand: Rand = Math.random): Len => (rand() < 0.5 ? 'short' : 'long')
/** Only correct answers can pay; the rich length pays more often. */
export const rewarded = (stim: Len, resp: Len, rich: Len, rand: Rand = Math.random) => stim === resp && rand() < (stim === rich ? RICH_P : LEAN_P)
/** kind = '<rich|lean shown>:<rich|lean answered>'. */
export const lengthKind = (stim: Len, resp: Len, rich: Len) => `${stim === rich ? 'rich' : 'lean'}:${resp === rich ? 'rich' : 'lean'}`

/**
 * responseBias is the signal-detection log b (Pizzagalli 2005), ½·log10((richOk·leanWrong)/(richWrong·leanOk)) with
 * 0.5 added to each cell: > 0 means answers lean toward the rich length.
 */
export function lengthsDetails(trials: Trial[]) {
  const n = (k: string) => trials.filter((t) => t.kind === k).length
  const [ro, rw, lo, lw] = [n('rich:rich'), n('rich:lean'), n('lean:lean'), n('lean:rich')]
  const r3 = (x: number) => Math.round(x * 1000) / 1000
  const total = ro + rw + lo + lw
  return {
    responseBias: total ? r3(0.5 * Math.log10(((ro + 0.5) * (lw + 0.5)) / ((rw + 0.5) * (lo + 0.5)))) : 0,
    accuracy: total ? r3((ro + lo) / total) : 0,
    richAccuracy: ro + rw ? r3(ro / (ro + rw)) : 0,
    leanAccuracy: lo + lw ? r3(lo / (lo + lw)) : 0,
  }
}

type Phase = { name: 'face' } | { name: 'flash' } | { name: 'answer' } | { name: 'result'; won: boolean; ok: boolean }

function LengthsGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [rich] = useState(() => makeLength())
  const [stim, setStim] = useState(() => makeLength())
  const [phase, setPhase] = useState<Phase>({ name: 'face' })
  const [total, setTotal] = useState(0)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  const played = useRef(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    levelRef.current = level
    doneRef.current = onDone
  })

  useEffect(() => {
    if (phase.name === 'answer') return
    const ms = { face: 500 + Math.round(Math.random() * 500), flash: FLASH_MS, result: feedback ? 1300 : 900 }[phase.name]
    const t = setTimeout(() => {
      if (phase.name === 'face') {
        itemLevel.current = levelRef.current
        shownAt.current = performance.now()
        return setPhase({ name: 'flash' })
      }
      if (phase.name === 'flash') return setPhase({ name: 'answer' })
      if (rounds && ++played.current >= rounds) return doneRef.current?.()
      setStim(makeLength())
      setPhase({ name: 'face' })
    }, ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function answer(resp: Len) {
    if (phase.name !== 'answer' && phase.name !== 'flash') return
    const ok = resp === stim
    onTrial({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: lengthKind(stim, resp, rich) })
    const won = rewarded(stim, resp, rich)
    if (won) setTotal((t) => t + 5)
    setPhase({ name: 'result', won, ok })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 's') answer('short')
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'l') answer('long')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const w = mouthWidth(stim, itemLevel.current)
  return (
    <div className="game">
      <div className="game__prompt">A mouth flashes for a split second. Was it the short one or the long one?</div>
      <svg className="pym-face" viewBox="0 0 200 200" role="img" aria-label="Face">
        <circle cx="100" cy="100" r="90" />
        <circle cx="70" cy="80" r="8" className="pym-face__eye" />
        <circle cx="130" cy="80" r="8" className="pym-face__eye" />
        {phase.name === 'flash' && <line x1={100 - w / 2} x2={100 + w / 2} y1="135" y2="135" className="pym-face__mouth" />}
      </svg>
      <div className="game__choices">
        <button type="button" className="btn game__choice" onClick={() => answer('short')}>
          <span className="pym-key">←</span> Short
        </button>
        <button type="button" className="btn game__choice" onClick={() => answer('long')}>
          Long <span className="pym-key">→</span>
        </button>
      </div>
      <div className="game__prompt pym-tally">Won {total}¢</div>
      <div className={`game__feedback ${phase.name === 'result' && (phase.won || feedback) ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {phase.name === 'result' && [phase.won && 'Correct! You won 5¢', feedback && !phase.won && (phase.ok ? `Right, it was ${stim}, but no reward this time` : `It was the ${stim} mouth`)].filter(Boolean).join(' ')}
      </div>
      <div className="game__keys">← or S short · → or L long</div>
    </div>
  )
}

export const lengths: GameDef = {
  id: 'lengths',
  name: 'Lengths',
  skills: ['probabilistic-reasoning', 'attention'],
  howTo: 'A face flashes a short or a long mouth for a tenth of a second; say which. Some correct answers win 5 cents.',
  duration: 150,
  targetRt: 900,
  Component: LengthsGame satisfies ComponentType<GameProps>,
  details: lengthsDetails,
}
