import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './arctic.css'
import { shuffle } from './SequenceReasoning'

type Rand = () => number
export const LIVES = 3
export const GRID = 4
/** 4 boxes at level 1 up to 9 at level 10. */
export const boxCount = (level: number) => 4 + Math.floor(((Math.min(10, Math.max(1, level)) - 1) * 5) / 9)
/** Distinct cells of the 4×4 field, one per box. */
export const layout = (n: number, rand: Rand = Math.random) => shuffle(Array.from({ length: GRID * GRID }, (_, i) => i), rand).slice(0, n)
/** The next token hides in a box that has not held one in this set. */
export function hideToken(n: number, held: number[], rand: Rand = Math.random) {
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !held.includes(i))
  return free[Math.floor(rand() * free.length)]!
}

export type OpenResult = 'token' | 'empty' | 'within' | 'between'
/** 'between' = the box already held a token this set; 'within' = already opened during this search. */
export function openBox(box: number, hidden: number, held: number[], opened: number[]): OpenResult {
  if (held.includes(box)) return 'between'
  if (opened.includes(box)) return 'within'
  return box === hidden ? 'token' : 'empty'
}

/** kind = 'search:<within errors>:<between errors>' for one search. */
export function tokenSearchDetails(trials: Trial[]) {
  const s = trials.filter((t) => t.kind?.startsWith('search:')).map((t) => t.kind!.split(':').map(Number))
  return {
    withinErrors: s.reduce((a, x) => a + x[1]!, 0),
    betweenErrors: s.reduce((a, x) => a + x[2]!, 0),
    perfectSearchRate: s.length ? Math.round((s.filter((x) => !x[1] && !x[2]).length / s.length) * 1000) / 1000 : 0,
  }
}

type SetState = { n: number; cells: number[]; held: number[]; hidden: number; level: number }
const newSet = (level: number): SetState => {
  const n = boxCount(level)
  return { n, cells: layout(n), held: [], hidden: hideToken(n, []), level }
}

const MSG: Record<OpenResult, string> = {
  token: 'Found it',
  empty: '',
  within: 'Already opened in this search',
  between: 'That box already held a token',
}

function TokenSearchGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [set, setSet] = useState(() => newSet(level))
  const [opened, setOpened] = useState<number[]>([])
  const [errs, setErrs] = useState({ within: 0, between: 0 })
  const [lives, setLives] = useState(LIVES)
  const [flash, setFlash] = useState<{ box: number; result: OpenResult; set: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const sets = useRef(0)
  const searchAt = useRef(performance.now())
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), flash.result === 'token' ? 900 : 600)
    return () => clearTimeout(t)
  }, [flash])
  useEffect(() => {
    if (!busy) return
    const t = setTimeout(() => {
      setBusy(false)
      // The next search starts when the boxes open again, not during the lockout.
      searchAt.current = performance.now()
    }, 900)
    return () => clearTimeout(t)
  }, [busy])

  /** Ends a set (all tokens found or no lives left): a new layout in practice, the end in a round-limited run. */
  function endSet() {
    sets.current++
    if (rounds && sets.current >= rounds) return onDone?.()
    setSet(newSet(levelRef.current))
    setLives(LIVES)
  }

  function open(box: number) {
    if (busy || box >= set.n) return
    const result = openBox(box, set.hidden, set.held, opened)
    setFlash({ box, result, set: sets.current })
    const e = { within: errs.within + Number(result === 'within'), between: errs.between + Number(result === 'between') }
    const left = lives - Number(result === 'within' || result === 'between')
    const finish = (found: boolean) => {
      onTrial({ correct: found && !e.within && !e.between, rt: performance.now() - searchAt.current, level: set.level, kind: `search:${e.within}:${e.between}` })
      setOpened([])
      setErrs({ within: 0, between: 0 })
      setBusy(true)
    }
    if (result === 'token') {
      finish(true)
      const held = [...set.held, box]
      if (held.length === set.n) endSet()
      else setSet({ ...set, held, hidden: hideToken(set.n, held) })
    } else if (left <= 0) {
      finish(false)
      // ponytail: out of lives ends the set; with `rounds` unset (practice and the unconfirmed real format) play restarts.
      if (rounds) return onDone?.()
      endSet()
    } else {
      setLives(left)
      setErrs(e)
      if (result === 'empty') setOpened([...opened, box])
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (!e.repeat && n >= 1 && n <= 9) open(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Find a token by opening boxes. Each box holds a token only once per set.
      </div>
      <div className="arc-tally game__prompt">
        Tokens {set.held.length} of {set.n} · Lives {'♥'.repeat(lives)}
        {'♡'.repeat(LIVES - lives)}
      </div>
      <div className="arc-field">
        {set.cells.map((cell, i) => {
          const showing = flash?.box === i && flash.set === sets.current ? flash.result : null
          return (
            <button
              key={`${sets.current}-${i}`}
              type="button"
              className="arc-box"
              style={{ gridColumn: (cell % GRID) + 1, gridRow: Math.floor(cell / GRID) + 1 }}
              data-state={showing === 'token' ? 'token' : showing ? 'open' : undefined}
              data-wrong={showing === 'within' || showing === 'between' ? 'true' : undefined}
              disabled={busy}
              onClick={() => open(i)}
              aria-label={`Box ${i + 1}`}
            >
              <span className="rsn-key">{i + 1}</span>
              {showing === 'token' && <span className="arc-token" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      <div className={`game__feedback ${flash && flash.result !== 'empty' ? (flash.result === 'token' ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {flash && (feedback || flash.result === 'token') && MSG[flash.result]}
      </div>
      <div className="game__keys">1–{set.n} or tap to open a box</div>
    </div>
  )
}

export const tokenSearch: GameDef = {
  id: 'token-search',
  name: 'Token Search',
  skills: ['working-memory', 'spatial-memory'],
  howTo: 'Open boxes to find each hidden token. A box never holds a token twice, so remember where you have found them and where you have looked.',
  duration: 240,
  targetRt: 6000,
  Component: TokenSearchGame satisfies ComponentType<GameProps>,
  details: tokenSearchDetails,
}
