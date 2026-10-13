import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import { Shape, type ShapeName } from './shapes'
import './core.css'
import './variants.css'

type Rand = () => number
export const LETTERS = ['B', 'C', 'D', 'F', 'H', 'K', 'M', 'R'] as const
export const MATCH_SHARE = 0.3

export const nFor = (level: number) => (level <= 3 ? 1 : level <= 7 ? 2 : 3)
/** How long each letter stays up and answerable. */
export const windowMs = (level: number) => Math.max(1500, 2600 - level * 110)

/** Next letter index given the stream so far: a match with MATCH_SHARE odds once n items exist, otherwise any other letter. */
export function nextItem(history: number[], n: number, rand: Rand = Math.random): number {
  const back = history[history.length - n]
  if (back !== undefined && rand() < MATCH_SHARE) return back
  let x: number
  do x = Math.floor(rand() * LETTERS.length)
  while (x === back)
  return x
}

export const isMatch = (history: number[], n: number) => history.length > n && history[history.length - 1] === history[history.length - 1 - n]
export const isCorrect = (match: boolean, saidMatch: boolean) => match === saidMatch

export function nBackDetails(trials: Trial[]) {
  const slow = trials.filter((t) => t.kind === 'slow').length
  return {
    hits: trials.filter((t) => t.kind === 'match' && t.correct).length,
    falseAlarms: trials.filter((t) => t.kind === 'nonmatch' && !t.correct).length,
    // Flashback only: missed response windows.
    ...(slow ? { tooSlow: slow } : {}),
  }
}

// Flashback (HireVue): shapes instead of letters, N rises through the run, colour joins the rule at 3-back.
export const FLASH_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross'] as const satisfies readonly ShapeName[]
export const FLASH_COLOURS = ['blue', 'orange', 'green'] as const
export type Flash = { s: number; c: number }

/** N for the k-th item of the run (0-based): 1-back for the first 12, 2-back up to 30, then 3-back. */
export const flashN = (count: number) => (count < 12 ? 1 : count < 30 ? 2 : 3)
/** At 3-back the colour joins the rule: a match needs the same shape and the same colour. */
export const colourRule = (n: number) => n === 3
/** Response window per shape: 2.4 s at level 1 down to 1.4 s at 10. */
export const flashWindowMs = (level: number) => Math.max(1400, 2500 - level * 110)

/** Next shape: a match with MATCH_SHARE odds; at the colour level a third of the rest are lures (same shape, other colour). */
export function nextFlash(history: Flash[], n: number, rand: Rand = Math.random): Flash {
  const back = history[history.length - n]
  const c = Math.floor(rand() * FLASH_COLOURS.length)
  if (back && rand() < MATCH_SHARE) return colourRule(n) ? { ...back } : { s: back.s, c }
  if (back && colourRule(n) && rand() < 0.33) return { s: back.s, c: (back.c + 1 + Math.floor(rand() * 2)) % 3 }
  let s: number
  do s = Math.floor(rand() * FLASH_SHAPES.length)
  while (back && s === back.s)
  return { s, c }
}

export function isFlashMatch(history: Flash[], n: number) {
  const a = history[history.length - 1]
  const b = history[history.length - 1 - n]
  return !!a && !!b && a.s === b.s && (!colourRule(n) || a.c === b.c)
}

const flashName = (f: Flash, n: number) => (colourRule(n) ? `${FLASH_COLOURS[f.c]} ${FLASH_SHAPES[f.s]}` : FLASH_SHAPES[f.s])

function FlashbackGame({ level, feedback, onTrial, ...props }: GameProps) {
  const rr = useRounds(props)
  const [history, setHistory] = useState<Flash[]>(() => [nextFlash([], 1)])
  const [fb, setFb] = useState<Fb | null>(null)
  const [count, setCount] = useState(0)
  const n = flashN(count)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  const current = history[history.length - 1]!
  const scored = history.length > n

  function advance() {
    itemLevel.current = levelRef.current
    const nextN = flashN(count + 1)
    setCount(count + 1)
    setFb(null)
    // A new N restarts the stream, as in the letter version.
    setHistory((h) => (nextN === n ? [...h.slice(-8), nextFlash(h, nextN)] : [nextFlash([], nextN)]))
  }

  function respond(saidMatch: boolean | null) {
    if (fb) return
    if (!scored) return saidMatch === null ? setFb({ ok: true, text: '', ms: 250 }) : undefined
    const match = isFlashMatch(history, n)
    const win = flashWindowMs(itemLevel.current)
    if (saidMatch === null) {
      onTrial({ correct: false, rt: win, level: itemLevel.current, kind: 'slow' })
      if (!rr.count()) setFb({ ok: false, text: 'Too slow', ms: 700 })
      return
    }
    const ok = match === saidMatch
    onTrial({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: match ? 'match' : 'nonmatch' })
    if (rr.count()) return
    const back = history[history.length - 1 - n]!
    const text = match
      ? `the ${flashName(current, n)} was also ${n} back`
      : `${n} back was the ${flashName(back, n)}${colourRule(n) && back.s === current.s ? ': same shape, different colour' : ''}`
    setFb({ ok, text, ms: feedback ? 900 : 250 })
  }

  useEffect(() => {
    if (fb) {
      const t = setTimeout(advance, fb.ms)
      return () => clearTimeout(t)
    }
    shownAt.current = performance.now()
    const t = setTimeout(() => respond(null), flashWindowMs(itemLevel.current))
    return () => clearTimeout(t)
  }, [fb, history])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowRight') respond(true)
      else if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowLeft') respond(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rule = colourRule(n) ? 'shape and colour' : 'shape'
  return (
    <div className="game">
      <div className="core-nback">
        {n}-back{colourRule(n) && ' · colour counts'}
      </div>
      <div aria-live="polite" className="game__prompt">
        {scored ? `Same ${rule} as ${n} ${n === 1 ? 'step' : 'steps'} ago?` : history.length === 1 && count ? `Now ${n}-back: the stream restarts` : `Remember this one (${history.length} of ${n})`}
      </div>
      <div className="game__stimulus var-flash" aria-label={fb ? undefined : flashName(current, 3)}>
        {!fb && <Shape name={FLASH_SHAPES[current.s]} className={`var-c${current.c}`} />}
        {!fb && colourRule(n) && <span className="var-flash__name" aria-hidden="true">{FLASH_COLOURS[current.c]}</span>}
      </div>
      <div className="game__choices">
        <button type="button" className="btn game__choice" onClick={() => respond(false)} disabled={!!fb || !scored}>
          F · No
        </button>
        <button type="button" className="btn btn--ink game__choice" onClick={() => respond(true)} disabled={!!fb || !scored}>
          J · Yes
        </button>
      </div>
      <div className={`game__feedback ${fb?.text === 'Too slow' || (fb?.text && feedback) ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb?.text === 'Too slow' ? 'Too slow' : fb?.text && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
      </div>
      <div className="game__keys">F or ← no · J or → yes · answer before the shape goes</div>
    </div>
  )
}

type Fb = { ok: boolean; text: string; ms: number }

function NBackGame({ level, feedback, onTrial, ...props }: GameProps) {
  const rr = useRounds(props)
  const [n, setN] = useState(() => nFor(level))
  const [history, setHistory] = useState<number[]>(() => [nextItem([], nFor(level))])
  const [fb, setFb] = useState<Fb | null>(null)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  const current = history[history.length - 1]!
  // The first n letters of a run have nothing to compare to: they are shown, not scored.
  const scored = history.length > n

  function advance() {
    const lvl = levelRef.current
    const nextN = nFor(lvl)
    itemLevel.current = lvl
    setN(nextN)
    setFb(null)
    // A change of N restarts the stream so the new rule never judges letters seen under the old one.
    setHistory((h) => (nextN === n ? [...h.slice(-8), nextItem(h, nextN)] : [nextItem([], nextN)]))
  }

  function respond(saidMatch: boolean, timedOut = false) {
    if (fb) return
    if (!scored) return timedOut ? setFb({ ok: true, text: '', ms: 250 }) : undefined
    const match = isMatch(history, n)
    const ok = isCorrect(match, saidMatch)
    const rt = timedOut ? windowMs(itemLevel.current) : performance.now() - shownAt.current
    onTrial({ correct: ok, rt, level: itemLevel.current, kind: match ? 'match' : 'nonmatch' })
    if (rr.count()) return
    const back = LETTERS[history[history.length - 1 - n]!]
    const text = match
      ? `${LETTERS[current]} was also ${n} back: a match${timedOut ? ' (no answer counts as no match)' : ''}`
      : `${n} back was ${back}, not ${LETTERS[current]}: no match`
    setFb({ ok, text, ms: feedback ? 900 : 250 })
  }

  useEffect(() => {
    if (fb) {
      const t = setTimeout(advance, fb.ms)
      return () => clearTimeout(t)
    }
    shownAt.current = performance.now()
    const t = setTimeout(() => respond(false, true), windowMs(itemLevel.current))
    return () => clearTimeout(t)
  }, [fb, history])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'j' || e.key === 'J') respond(true)
      else if (e.key === 'f' || e.key === 'F') respond(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div className="core-nback">
        {n}-back
      </div>
      <div aria-live="polite" className="game__prompt">
        {scored ? `Same letter as ${n} ${n === 1 ? 'step' : 'steps'} ago?` : `Remember this one (${history.length} of ${n})`}
      </div>
      <div className="game__stimulus">{fb ? '' : LETTERS[current]}</div>
      <div className="game__choices">
        <button type="button" className="btn game__choice" onClick={() => respond(false)} disabled={!!fb || !scored}>
          F · No match
        </button>
        <button type="button" className="btn btn--ink game__choice" onClick={() => respond(true)} disabled={!!fb || !scored}>
          J · Match
        </button>
      </div>
      <div className={`game__feedback ${fb?.text && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb?.text && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
      </div>
      <div className="game__keys">F no match · J match · no answer counts as no match</div>
    </div>
  )
}

export const nBack: GameDef = {
  id: 'n-back',
  name: 'N-back',
  skills: ['working-memory', 'attention'],
  howTo: 'Letters appear one by one; answer Match when the letter is the same as the one N steps earlier.',
  duration: 120,
  targetRt: 1200,
  Component: ((p: GameProps) => (p.variant === 'flashback' ? <FlashbackGame {...p} /> : <NBackGame {...p} />)) satisfies ComponentType<GameProps>,
  details: nBackDetails,
}
