import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import { shuffle } from './SequenceReasoning'
import { Shape, type ShapeName } from './shapes'
import './games.css'
import './reasoning.css'
import './aon.css'

type Rand = () => number
/** A switch: output position i takes the input symbol at code[i] (0-based; shown 1-based, e.g. 3142). */
export type Code = number[]
export type SwitchItem = { input: ShapeName[]; switches: (Code | null)[]; output: ShapeName[]; choices: Code[]; answer: number }

const SYMBOLS: ShapeName[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross']
const PERMS: Code[] = (function perms(xs: number[]): Code[] {
  return xs.length <= 1 ? [xs] : xs.flatMap((x) => perms(xs.filter((y) => y !== x)).map((p) => [x, ...p]))
})([0, 1, 2, 3])
const IDENTITY = '0123'

export const applyCode = <T,>(code: Code, row: T[]) => code.map((i) => row[i]!)
export const codeLabel = (code: Code) => code.map((i) => i + 1).join('')
const same = (a: Code, b: Code) => a.join('') === b.join('')
const swapOne = (c: Code, rand: Rand) => {
  const [i, j] = shuffle([0, 1, 2, 3], rand)
  const d = [...c]
  ;[d[i!], d[j!]] = [d[j!]!, d[i!]!]
  return d
}

/** Two chained switches with one missing from level 5 (share rising to 80%); distractors one swap from the answer from level 4. */
export function makeSwitchItem(level: number, rand: Rand = Math.random): SwitchItem {
  const input = shuffle(SYMBOLS, rand).slice(0, 4)
  const pick = () => {
    const pool = PERMS.filter((p) => p.join('') !== IDENTITY)
    return pool[Math.floor(rand() * pool.length)]!
  }
  const chain = level >= 5 && rand() < 0.2 + (level - 5) * 0.15
  const codes = chain ? [pick(), pick()] : [pick()]
  const output = codes.reduce<ShapeName[]>((row, c) => applyCode(c, row), input)
  const missing = chain ? Math.floor(rand() * 2) : 0
  const ans = codes[missing]!
  const nNear = level >= 7 ? 2 : level >= 4 ? 1 : 0
  const wrong: Code[] = []
  while (wrong.length < 2) {
    const w = wrong.length < nNear ? swapOne(ans, rand) : pick()
    if (!same(w, ans) && !wrong.some((x) => same(x, w))) wrong.push(w)
  }
  const choices = shuffle([ans, ...wrong], rand)
  return { input, switches: codes.map((c, i) => (i === missing ? null : c)), output, choices, answer: choices.indexOf(ans) }
}

/** True when the choice, put in the missing slot, turns the input into the output. */
export const switchWorks = (item: SwitchItem, code: Code) =>
  item.switches.reduce<ShapeName[]>((row, c) => applyCode(c ?? code, row), item.input).join() === item.output.join()

/** kind 'single' | 'chain'. */
export function switchDetails(trials: Trial[]) {
  const acc = (k: string) => {
    const xs = trials.filter((t) => t.kind === k)
    return xs.length ? Math.round((xs.filter((t) => t.correct).length / xs.length) * 1000) / 1000 : 0
  }
  return { singleAccuracy: acc('single'), chainAccuracy: acc('chain') }
}

const Row = ({ row, label }: { row: ShapeName[]; label: string }) => (
  <div className="aon-row" role="img" aria-label={`${label}: ${row.join(', ')}`}>
    {row.map((s, i) => (
      <Shape key={i} name={s} size={36} />
    ))}
  </div>
)

function SwitchChallengeGame({ level, mode, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [item, setItem] = useState(() => makeSwitchItem(level))
  const [fb, setFb] = useState<number | null>(null)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    shownAt.current = performance.now()
    itemLevel.current = levelRef.current
  }, [item])
  useEffect(() => {
    if (fb === null) return
    const t = setTimeout(
      () => {
        setFb(null)
        setItem(makeSwitchItem(levelRef.current))
      },
      feedback ? 1600 : 200,
    )
    return () => clearTimeout(t)
  }, [fb, feedback])

  function choose(i: number) {
    if (fb !== null || i >= item.choices.length) return
    onTrial({ correct: i === item.answer, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: item.switches.length > 1 ? 'chain' : 'single' })
    if (!r.count()) setFb(i)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const n = Number(e.key)
      if (n >= 1 && n <= 3) choose(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const ans = item.choices[item.answer]!
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        Which code turns the top row into the bottom row?
      </div>
      <div className="aon-switch">
        <Row row={item.input} label="Input" />
        {item.switches.map((c, i) => (
          <div key={i} className="aon-switch__box" data-missing={c ? undefined : 'true'}>
            {c ? codeLabel(c) : '?'}
          </div>
        ))}
        <Row row={item.output} label="Output" />
      </div>
      <div className="game__choices">
        {item.choices.map((c, i) => (
          <button key={i} type="button" className="btn game__choice rsn-choice" data-answer={fb !== null && feedback && i === item.answer ? 'true' : undefined} disabled={fb !== null} onClick={() => choose(i)}>
            <span className="rsn-key">{i + 1}</span> {codeLabel(c)}
          </button>
        ))}
      </div>
      <div className={`game__feedback ${fb !== null && feedback ? (fb === item.answer ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb !== null && feedback && `${fb === item.answer ? 'Right' : 'Not quite'}: ${codeLabel(ans)} puts input symbols ${ans.map((x) => x + 1).join(', ')} in positions 1–4`}
      </div>
      <div className="game__keys">1–3 to answer</div>
    </div>
  )
}

export const switchChallenge: GameDef = {
  id: 'switch-challenge',
  name: 'Switch challenge',
  skills: ['logical-reasoning'],
  howTo: 'Each digit of a code says which input position moves to that spot; pick the code that produces the output row.',
  duration: 360,
  targetRt: 6000,
  Component: SwitchChallengeGame satisfies ComponentType<GameProps>,
  details: switchDetails,
}
