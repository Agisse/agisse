import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { median } from '../engine/session'
import { useRounds } from './rounds'
import { Shape, type ShapeName } from './shapes'
import './core.css'
import './variants.css'

type Rand = () => number
export type Rule = 'parity' | 'magnitude'
export type SwitchItem = { digit: number; rule: Rule; kind: 'switch' | 'repeat' | 'start'; level: number }
export type Side = 'F' | 'J'

const DIGITS = [1, 2, 3, 4, 6, 7, 8, 9] as const

/** Chance the rule changes from one item to the next: 0.24 at level 1 up to 0.6 at 10. */
export const switchChance = (level: number) => 0.2 + level * 0.04
/** Time to answer before the item counts as wrong. */
export const windowMs = (level: number) => Math.max(1500, 4000 - level * 250)
/** The rule tag is dropped at 7+; colour plus shape (circle = odd/even, square = low/high) still mark the rule. */
export const showTag = (level: number) => level < 7

export function makeItem(prev: Rule | null, level: number, rand: Rand = Math.random): SwitchItem {
  const digit = DIGITS[Math.floor(rand() * DIGITS.length)]!
  if (!prev) return { digit, rule: rand() < 0.5 ? 'parity' : 'magnitude', kind: 'start', level }
  const change = rand() < switchChance(level)
  return { digit, rule: change ? (prev === 'parity' ? 'magnitude' : 'parity') : prev, kind: change ? 'switch' : 'repeat', level }
}

/** F = odd / low, J = even / high. */
export const correctSide = (item: SwitchItem): Side =>
  item.rule === 'parity' ? (item.digit % 2 ? 'F' : 'J') : item.digit < 5 ? 'F' : 'J'
export const isCorrect = (item: SwitchItem, side: Side | null) => side === correctSide(item)

export function taskSwitchingDetails(trials: Trial[]) {
  const sw = trials.filter((t) => t.kind === 'switch')
  const rep = trials.filter((t) => t.kind === 'repeat')
  const okRts = (ts: Trial[]) => ts.filter((t) => t.correct).map((t) => t.rt)
  const acc = (ts: Trial[]) => (ts.length ? Math.round((ts.filter((t) => t.correct).length / ts.length) * 1000) / 1000 : 0)
  const s = okRts(sw)
  const r = okRts(rep)
  return {
    switchCostMs: s.length && r.length ? Math.round(median(s) - median(r)) : 0,
    switchAccuracy: acc(sw),
    repeatAccuracy: acc(rep),
  }
}

const explain = (item: SwitchItem) =>
  item.rule === 'parity'
    ? `blue asks odd or even: ${item.digit} is ${item.digit % 2 ? 'odd (F)' : 'even (J)'}`
    : `orange asks low or high: ${item.digit} is ${item.digit < 5 ? 'below 5 (F)' : 'above 5 (J)'}`

// Tickets (Arctic Shores): top half asks about the number (even?), bottom half about the shape (has corners?).
export const TICKET_SHAPES = ['circle', 'oval', 'triangle', 'square', 'diamond', 'pentagon'] as const satisfies readonly ShapeName[]
export type Ticket = { num: number; shape: (typeof TICKET_SHAPES)[number]; top: boolean; kind: 'switch' | 'repeat' | 'start'; level: number }
/** The rule reminder shows for this many tickets, then fades. */
export const REMINDER_TICKETS = 10

export const hasCorners = (shape: ShapeName) => shape !== 'circle' && shape !== 'oval'
/** Time per ticket: 1.5 s in a simulation; in practice 2.3 s at level 1 down to 1.1 s at 10. */
export const ticketMs = (level: number, simulation: boolean) => (simulation ? 1500 : Math.max(1100, 2400 - level * 130))

/** The half is a coin flip, so about half the tickets switch question. */
export function makeTicket(prevTop: boolean | null, level: number, rand: Rand = Math.random): Ticket {
  const num = DIGITS[Math.floor(rand() * DIGITS.length)]!
  const shape = TICKET_SHAPES[Math.floor(rand() * TICKET_SHAPES.length)]!
  const top = rand() < 0.5
  return { num, shape, top, kind: prevTop === null ? 'start' : top === prevTop ? 'repeat' : 'switch', level }
}
/** Yes for an even number (top half) or a shape with corners (bottom half). */
export const ticketYes = (t: Ticket) => (t.top ? t.num % 2 === 0 : hasCorners(t.shape))
export const isTicketCorrect = (t: Ticket, yes: boolean | null) => yes === ticketYes(t)

const explainTicket = (t: Ticket) =>
  t.top ? `top half asks about the number: ${t.num} is ${t.num % 2 ? 'odd (no)' : 'even (yes)'}` : `bottom half asks about the shape: a ${t.shape} ${hasCorners(t.shape) ? 'has corners (yes)' : 'has no corners (no)'}`

function TicketsGame({ level, feedback, onTrial, mode, ...props }: GameProps) {
  const rr = useRounds({ ...props, mode })
  const [ticket, setTicket] = useState(() => makeTicket(null, level))
  const [fb, setFb] = useState<{ ok: boolean; text: string; ms: number } | null>(null)
  const [count, setCount] = useState(0)
  const shownAt = useRef(0)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  const win = ticketMs(ticket.level, mode === 'simulation')

  function answer(yes: boolean | null) {
    if (fb) return
    const ok = isTicketCorrect(ticket, yes)
    onTrial({ correct: ok, rt: yes === null ? win : performance.now() - shownAt.current, level: ticket.level, kind: ticket.kind })
    setCount((c) => c + 1)
    if (rr.count()) return
    setFb({ ok, text: yes === null ? `too slow; ${explainTicket(ticket)}` : explainTicket(ticket), ms: feedback ? 1000 : 150 })
  }

  useEffect(() => {
    if (fb) {
      const t = setTimeout(() => {
        setFb(null)
        setTicket(makeTicket(ticket.top, levelRef.current))
      }, fb.ms)
      return () => clearTimeout(t)
    }
    shownAt.current = performance.now()
    const t = setTimeout(() => answer(null), win)
    return () => clearTimeout(t)
  }, [fb, ticket])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toUpperCase()
      if (k === 'Q' || k === 'ARROWLEFT') answer(false)
      else if (k === 'P' || k === 'ARROWRIGHT') answer(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const remind = count < REMINDER_TICKETS
  return (
    <div className="game">
      <div className="var-reminder" data-faded={!remind} aria-hidden={!remind}>
        <span>Top: is the number even?</span>
        <span>Bottom: does the shape have corners?</span>
      </div>
      <div className="var-tickets" aria-live="polite" aria-label={fb ? undefined : `${ticket.top ? 'Top' : 'Bottom'} half: ${ticket.num} and a ${ticket.shape}`}>
        {(['top', 'bottom'] as const).map((half) => (
          <div key={half} className="var-tickets__half">
            {!fb && ticket.top === (half === 'top') && (
              <div className="var-ticket">
                <span className="var-ticket__num">{ticket.num}</span>
                <Shape name={ticket.shape} size={56} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="game__choices">
        <button type="button" className="btn game__choice" onClick={() => answer(false)} disabled={!!fb}>
          Q · No
        </button>
        <button type="button" className="btn game__choice" onClick={() => answer(true)} disabled={!!fb}>
          P · Yes
        </button>
      </div>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
      </div>
      <div className="game__keys">Q or ← no · P or → yes</div>
    </div>
  )
}

function TaskSwitchingGame({ level, feedback, onTrial, ...props }: GameProps) {
  const rr = useRounds(props)
  const [item, setItem] = useState(() => makeItem(null, level))
  const [fb, setFb] = useState<{ ok: boolean; text: string; ms: number } | null>(null)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  function answer(side: Side | null) {
    if (fb) return
    const ok = isCorrect(item, side)
    const rt = side ? performance.now() - shownAt.current : windowMs(itemLevel.current)
    onTrial({ correct: ok, rt, level: itemLevel.current, kind: item.kind })
    if (rr.count()) return
    setFb({ ok, text: side ? explain(item) : `time ran out; ${explain(item)}`, ms: feedback ? 900 : 200 })
  }

  useEffect(() => {
    if (fb) {
      const t = setTimeout(() => {
        itemLevel.current = levelRef.current
        setFb(null)
        setItem(makeItem(item.rule, levelRef.current))
      }, fb.ms)
      return () => clearTimeout(t)
    }
    shownAt.current = performance.now()
    const t = setTimeout(() => answer(null), windowMs(itemLevel.current))
    return () => clearTimeout(t)
  }, [fb, item])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key
      if (k === 'F' || k === 'ArrowLeft') answer('F')
      else if (k === 'J' || k === 'ArrowRight') answer('J')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const parity = item.rule === 'parity'
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {fb ? '' : parity ? 'Odd or even?' : 'Lower or higher than 5?'}
      </div>
      <div className="core-switch">
        {showTag(item.level) && <span className={`core-tag core-tag--${item.rule}`}>{parity ? 'ODD / EVEN' : 'LOW / HIGH'}</span>}
        <div className={`core-digit core-digit--${item.rule}`} aria-label={`${item.digit}, ${parity ? 'odd or even' : 'low or high'}`}>
          {fb ? '' : item.digit}
        </div>
      </div>
      <div className="game__choices">
        <button type="button" className="btn game__choice" onClick={() => answer('F')} disabled={!!fb}>
          F · odd / low
        </button>
        <button type="button" className="btn game__choice" onClick={() => answer('J')} disabled={!!fb}>
          J · even / high
        </button>
      </div>
      <div className={`game__feedback ${fb && feedback ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && feedback && `${fb.ok ? 'Right' : 'Not quite'}: ${fb.text}`}
      </div>
      <div className="game__keys">Blue circle: F odd · J even · Orange square: F below 5 · J above 5 (arrow keys work too)</div>
    </div>
  )
}

export const taskSwitching: GameDef = {
  id: 'task-switching',
  name: 'Rule switching',
  skills: ['cognitive-flexibility'],
  howTo: 'Blue digits: odd or even. Orange digits: below or above 5. The rule can change on any item.',
  duration: 120,
  targetRt: 1100,
  Component: ((p: GameProps) => (p.variant === 'tickets' ? <TicketsGame {...p} /> : <TaskSwitchingGame {...p} />)) satisfies ComponentType<GameProps>,
  details: taskSwitchingDetails,
}
