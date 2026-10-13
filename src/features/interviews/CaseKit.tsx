// Case interviews, no model: mental maths, market sizing against a reference tree, and a framework primer.
import { useRef, useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import { FRAMEWORKS, MATH_KINDS, SIZING, checkMath, fmt, mathDrill, parseNumber, rng, scoreSizing, type MathKind, type MathQuestion, type SizingResult } from '../../../shared/case-kit'
import { Segmented } from './Segmented'
import { clock, useElapsed, useStored } from './useStored'

const TABS = [
  ['maths', 'Mental maths'],
  ['sizing', 'Market sizing'],
  ['frameworks', 'Frameworks'],
] as const

export function CaseKit() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('maths')
  return (
    <div className="iv-section">
      <Segmented label="Case practice" options={TABS} value={tab} onChange={setTab} />
      {tab === 'maths' ? <MentalMaths /> : tab === 'sizing' ? <MarketSizing /> : <Frameworks />}
    </div>
  )
}

type MathRun = { at: string; correct: number; total: number; sec: number }
const DRILL = 10

function MentalMaths() {
  const [kinds, setKinds] = useState<MathKind[]>(['percent', 'growth', 'breakeven', 'division'])
  const [drill, setDrill] = useState<MathQuestion[] | null>(null)
  const [i, setI] = useState(0)
  const [input, setInput] = useState('')
  const [results, setResults] = useState<boolean[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [history, setHistory] = useStored<MathRun[]>('case-maths', [])
  const elapsed = useElapsed(startedAt)
  const field = useRef<HTMLInputElement | null>(null)
  const done = drill && i >= drill.length

  const start = () => {
    setDrill(mathDrill(kinds, DRILL, rng(Date.now())))
    setI(0)
    setResults([])
    setInput('')
    setStartedAt(Date.now())
    setTimeout(() => field.current?.focus())
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!drill || done || !input.trim()) return
    const next = [...results, checkMath(drill[i]!, input)]
    setResults(next)
    setInput('')
    setI(i + 1)
    if (i + 1 >= drill.length) {
      setHistory([{ at: new Date().toISOString(), correct: next.filter(Boolean).length, total: next.length, sec: elapsed }, ...history].slice(0, 20))
      setStartedAt(null)
    }
  }
  const toggle = (k: MathKind) => setKinds(kinds.includes(k) ? (kinds.length > 1 ? kinds.filter((x) => x !== k) : kinds) : [...kinds, k])
  const lastQ = drill && i > 0 ? drill[i - 1]! : null

  if (!drill || done)
    return (
      <div className="iv-pane">
        <p className="prep__lede">Ten quick sums, no calculator. Round sensibly; division answers within 5% count.</p>
        <div className="chips" role="group" aria-label="Question types">
          {(Object.keys(MATH_KINDS) as MathKind[]).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kinds.includes(k)} onClick={() => toggle(k)}>
              {MATH_KINDS[k]}
            </button>
          ))}
        </div>
        {done && (
          <p className="iv-result tnum" role="status">
            {results.filter(Boolean).length} of {results.length} right in {clock(history[0]?.sec ?? 0)}
          </p>
        )}
        <button type="button" className="btn btn--primary iv-start-btn" onClick={start}>
          {done ? 'Try again' : 'Start sums'}
        </button>
        {history.length > 1 && <p className="prep__meta tnum">Earlier: {history.slice(done ? 1 : 0, 6).map((h) => `${Math.round((h.correct / h.total) * 100)}% in ${clock(h.sec)}`).join(' · ')}</p>}
      </div>
    )

  const q = drill[i]!
  return (
    <form className="iv-pane" onSubmit={submit}>
      <div className="practice__bar">
        <span className="label tnum">
          {i + 1} of {drill.length}
        </span>
        <span className="practice__clock tnum">{clock(elapsed)}</span>
      </div>
      <p className="mock__question">{q.prompt}</p>
      <div className="iv-answer">
        <input ref={field} className="field__input" inputMode="decimal" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Your answer" placeholder={q.unit === '%' ? 'e.g. 12.5' : 'e.g. 1.2m or 350k'} />
        <button type="submit" className="btn btn--primary">
          Answer
        </button>
      </div>
      {lastQ && (
        <p className="prep__meta tnum" role="status">
          {results[i - 1] ? <Check aria-hidden="true" className="iv-ok" /> : <X aria-hidden="true" className="iv-miss" />} Last one: {fmt(lastQ.answer)}
          {lastQ.unit && ` ${lastQ.unit}`}
        </p>
      )}
    </form>
  )
}

function MarketSizing() {
  const [id, setId] = useState(SIZING[0]!.id)
  const [drivers, setDrivers] = useState('')
  const [estimate, setEstimate] = useState('')
  const [result, setResult] = useState<SizingResult | null>(null)
  const p = SIZING.find((x) => x.id === id)!
  const value = parseNumber(estimate)
  const choose = (next: string) => {
    setId(next)
    setDrivers('')
    setEstimate('')
    setResult(null)
  }

  return (
    <div className="iv-pane">
      <p className="prep__lede">Market sizing means estimating a number, like how many coffees a city drinks a day, by breaking it into drivers.</p>
      <label className="field">
        <span className="label">Question</span>
        <select className="field__input" value={id} onChange={(e) => choose(e.target.value)}>
          {SIZING.map((x) => (
            <option key={x.id} value={x.id}>
              {x.prompt}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Your drivers</span>
        <textarea className="field__input" rows={4} value={drivers} onChange={(e) => setDrivers(e.target.value)} placeholder={'One per line, e.g.\nPopulation: 1.2m\nShare who buy: 40%'} />
      </label>
      <div className="iv-answer">
        <input className="field__input" inputMode="decimal" value={estimate} onChange={(e) => setEstimate(e.target.value)} aria-label={`Your estimate, in ${p.unit}`} placeholder={`Your estimate (${p.unit})`} />
        <button type="button" className="btn btn--primary" disabled={value === null || value <= 0} onClick={() => setResult(scoreSizing(p, value!, drivers))}>
          Compare
        </button>
      </div>
      {result && (
        <div className="iv-feedback" role="status">
          <p className="iv-result tnum">
            {result.verdict === 'close' ? 'Close' : result.verdict === 'ballpark' ? 'Right ballpark' : 'Far off'}: {fmt(value!)} against a reference of {fmt(p.answer)} {p.unit}.
          </p>
          {result.missed.length > 0 && <p className="prep__meta">Drivers you did not name: {result.missed.map((d) => d.driver.toLowerCase()).join(', ')}.</p>}
          <p className="label">Reference tree</p>
          <ul className="iv-tree">
            {p.tree.map((d) => (
              <li key={d.driver}>
                {d.driver} <span className="tnum">{d.value}</span>
              </li>
            ))}
          </ul>
          <p className="prep__meta">{p.formula}. One defensible set of assumptions, not a fact; the structure matters more than the number.</p>
        </div>
      )}
    </div>
  )
}

function Frameworks() {
  return (
    <div className="iv-pane">
      <p className="prep__lede">Starting points, not scripts. Interviewers reward a structure built for their question.</p>
      {FRAMEWORKS.map((f) => (
        <details key={f.id} className="iv-fold">
          <summary>{f.name}</summary>
          <p className="prep__meta">{f.when}</p>
          <dl className="iv-dl">
            {f.buckets.map((b) => (
              <div key={b.name}>
                <dt>{b.name}</dt>
                <dd>{b.ask}</dd>
              </div>
            ))}
          </dl>
          <p className="prep__meta">{f.watch}</p>
        </details>
      ))}
    </div>
  )
}
