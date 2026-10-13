import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { median } from '../engine/session'
import './games.css'
import './pymetrics.css'

type Rand = () => number
export type Dir = 'L' | 'R'
/** mid = answer the centre arrow, side = answer the flankers (red), nogo = X flankers, press nothing. */
export type Rule = 'mid' | 'side' | 'nogo'
export type FlankItem = { rule: Rule; centre: Dir; flank: Dir | 'X'; colour: 'black' | 'blue' | 'red'; switched: boolean }

const dir = (rand: Rand): Dir => (rand() < 0.5 ? 'L' : 'R')

/** arrows: a third red (answer the sides). direction: a fifth no-go (X flankers). Half of arrow trials incongruent. */
export function makeFlankItem(variant: string | undefined, prev: Rule | null, rand: Rand = Math.random): FlankItem {
  const centre = dir(rand)
  const flank = rand() < 0.5 ? centre : centre === 'L' ? 'R' : 'L'
  if (variant === 'direction') {
    const nogo = rand() < 0.2
    return { rule: nogo ? 'nogo' : 'mid', centre, flank: nogo ? 'X' : flank, colour: 'black', switched: false }
  }
  const rule: Rule = rand() < 1 / 3 ? 'side' : 'mid'
  return { rule, centre, flank, colour: rule === 'side' ? 'red' : rand() < 0.5 ? 'black' : 'blue', switched: prev !== null && prev !== rule }
}

export const answerOf = (it: FlankItem): Dir | null => (it.rule === 'nogo' ? null : it.rule === 'side' ? (it.flank as Dir) : it.centre)
export const isCorrect = (it: FlankItem, resp: Dir | null) => resp === answerOf(it)
/** 'nogo' or '<mid|side>:<cong|incong>:<switch|repeat>'. */
export const flankKind = (it: FlankItem) => (it.rule === 'nogo' ? 'nogo' : `${it.rule}:${it.flank === it.centre ? 'cong' : 'incong'}:${it.switched ? 'switch' : 'repeat'}`)

/** arrows: 2200 ms at level 1 down to 1120 at 10. direction also speeds up 6 ms a round, never under 500. */
export function windowMs(variant: string | undefined, level: number, round: number) {
  if (variant === 'direction') return Math.max(500, 1500 - (level - 1) * 60 - round * 6)
  return 2200 - (level - 1) * 120
}
/** Text tag on the arrows up to level 3, so the colour rule is learnt before it has to be read from colour alone. */
export const showTag = (level: number) => level <= 3

export function flankerDetails(trials: Trial[]) {
  const okRt = (re: RegExp) => trials.filter((t) => t.correct && re.test(t.kind ?? '')).map((t) => t.rt)
  const [inc, con] = [okRt(/:incong:/), okRt(/:cong:/)]
  return {
    congruencyCostMs: inc.length && con.length ? Math.round(median(inc) - median(con)) : 0,
    ruleSwitchErrors: trials.filter((t) => !t.correct && t.kind?.endsWith(':switch')).length,
    noGoErrors: trials.filter((t) => !t.correct && t.kind === 'nogo').length,
  }
}

const GLYPH = { L: '←', R: '→', X: '✕' } as const
type Phase = { name: 'wait'; ms: number } | { name: 'stim'; item: FlankItem } | { name: 'pause'; ok: boolean; text: string }

function explain(it: FlankItem) {
  if (it.rule === 'nogo') return 'X’s mean hold back'
  const a = answerOf(it) === 'L' ? 'left' : 'right'
  return it.rule === 'side' ? `red: follow the side arrows (${a})` : `${it.colour}: follow the middle arrow (${a})`
}

const word = (d: Dir | 'X') => (d === 'X' ? 'X' : d === 'L' ? 'left' : 'right')
const describe = (it: FlankItem) => `${it.colour}: middle ${word(it.centre)}, sides ${word(it.flank)}`

function FlankerGame({ level, feedback, onTrial, variant, rounds, onDone }: GameProps) {
  const direction = variant === 'direction'
  const [phase, setPhase] = useState<Phase>({ name: 'wait', ms: 800 })
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  const prevRule = useRef<Rule | null>(null)
  const played = useRef(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    levelRef.current = level
    doneRef.current = onDone
  })

  function settle(resp: Dir | null) {
    if (phase.name !== 'stim') return
    const it = phase.item
    const ok = isCorrect(it, resp)
    onTrial({ correct: ok, rt: resp ? performance.now() - shownAt.current : windowMs(variant, itemLevel.current, played.current), withheld: ok && !resp, level: itemLevel.current, kind: flankKind(it) })
    played.current++
    if (rounds && played.current >= rounds) return doneRef.current?.()
    setPhase(feedback ? { name: 'pause', ok, text: explain(it) } : { name: 'wait', ms: 400 + Math.round(Math.random() * 300) })
  }

  useEffect(() => {
    if (phase.name === 'stim') {
      shownAt.current = performance.now()
      const t = setTimeout(() => settle(null), windowMs(variant, itemLevel.current, played.current))
      return () => clearTimeout(t)
    }
    const t = setTimeout(
      () => {
        if (phase.name === 'pause') return setPhase({ name: 'wait', ms: 500 })
        itemLevel.current = levelRef.current
        const item = makeFlankItem(variant, prevRule.current)
        prevRule.current = item.rule
        setPhase({ name: 'stim', item })
      },
      phase.name === 'pause' ? 1000 : phase.ms,
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      const d: Dir | null = k === 'arrowleft' || k === 'q' ? 'L' : k === 'arrowright' || k === 'p' ? 'R' : null
      if (!d) return
      e.preventDefault()
      settle(d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const it = phase.name === 'stim' ? phase.item : null
  const [lk, rk] = direction ? ['Q', 'P'] : ['←', '→']
  return (
    <div className="game">
      <div className="game__prompt">
        {direction ? 'Answer the middle arrow. If the side arrows are X’s, press nothing.' : 'Black or blue: answer the middle arrow. Red: answer the side arrows.'}
      </div>
      <div className="pym-flank" data-colour={it?.colour}>
        {it ? (
          <>
            <span aria-hidden="true">
              {[it.flank, it.flank, it.centre, it.flank, it.flank].map((g, i) => (
                <span key={i}>{GLYPH[g]}</span>
              ))}
            </span>
            <span className="sr-only">{describe(it)}</span>
            {!direction && showTag(itemLevel.current) && <span className="pym-flank__tag">{it.rule === 'side' ? 'sides' : 'middle'}</span>}
          </>
        ) : (
          <span className="pym-flank__fix" aria-hidden="true">
            +
          </span>
        )}
      </div>
      <div className="game__choices">
        <button type="button" className="btn game__choice" onClick={() => settle('L')}>
          <span className="pym-key">{lk}</span> Left
        </button>
        <button type="button" className="btn game__choice" onClick={() => settle('R')}>
          Right <span className="pym-key">{rk}</span>
        </button>
      </div>
      <div className={`game__feedback ${phase.name === 'pause' ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {phase.name === 'pause' && `${phase.ok ? 'Right' : 'Not quite'}: ${phase.text}`}
      </div>
      <div className="game__keys">{direction ? 'Q left · P right · nothing on X' : '← left · → right'}</div>
    </div>
  )
}

export const flanker: GameDef = {
  id: 'flanker',
  name: 'Arrows',
  skills: ['attention', 'inhibition', 'cognitive-flexibility'],
  howTo: 'Five arrows flash. Usually answer the middle one; when they are red, answer the side arrows instead.',
  duration: 150,
  targetRt: 700,
  Component: FlankerGame satisfies ComponentType<GameProps>,
  details: flankerDetails,
}
