// /prepare/interviews/banking: investment banking prep, all in the browser with no model call.
// One primary action (technicals by topic), then quiet sections: paper LBO, pitch, networking calls, calendar, resources.
import { useState } from 'react'
import { Link } from 'wouter'
import { Check, ChevronDown, ChevronLeft, X } from 'lucide-react'
import { CALENDAR, CALL_AVOID, CALL_QUESTIONS, CALL_STEPS, PATH, PITCH_PARTS, PITCH_RANGE, RESOURCES, ROUNDS, lboClose, paperLbo, pitchSeconds, solveLbo, type PitchPart } from '../../../shared/banking'
import { parseNumber } from '../../../shared/case-kit'
import { CARDS, TOPICS, type Topic } from '../../../shared/technicals'
import { Technicals, type CardGroup } from './Technicals'
import { useHashSection, useStored } from './useStored'
import './interviews.css'

const FINANCE = CARDS.filter((c) => c.topic)
const GROUPS: CardGroup[] = [...(Object.entries(TOPICS) as [Topic, string][]).map(([t, label]) => [t, label, FINANCE.filter((c) => c.topic === t)] as const), ['all', 'All', FINANCE]]

const SECTIONS = [
  ['lbo', 'Paper LBO', 'A five-minute deal to solve with pen and paper'],
  ['pitch', 'Your pitch', '“Tell me about yourself” in about 90 seconds'],
  ['calls', 'Networking calls', 'How to run a call that ends with a second name'],
  ['calendar', 'Recruiting calendar', 'When European banks hire, and the rounds'],
  ['resources', 'Resources', 'The guides, courses and tools worth your time'],
] as const
type Section = (typeof SECTIONS)[number][0]

export function Banking() {
  const [open, toggle] = useHashSection<Section>(SECTIONS.map(([id]) => id))
  return (
    <main className="map interviews">
      <div className="ib-head">
        <Link href="/prepare/interviews" className="ib-back">
          <ChevronLeft aria-hidden="true" />
          Interviews
        </Link>
        <h2 className="ib-title">Investment banking</h2>
        <p className="prep__lede">A first round is half fit, half technicals. Drill the technicals topic by topic; cards you know come back less often.</p>
      </div>

      <section className="iv-start" aria-labelledby="ib-drill">
        <h3 id="ib-drill" className="iv-start__title">
          Technicals
        </h3>
        <Technicals groups={GROUPS} label="Topic" />
      </section>

      <ul className="iv-more">
        {SECTIONS.map(([sid, title, line]) => (
          <li key={sid} id={sid}>
            <button type="button" className="iv-more__row" aria-expanded={open === sid} aria-controls={`${sid}-panel`} onClick={() => toggle(sid)}>
              <span>
                <span className="iv-more__title">{title}</span>
                <span className="iv-more__line">{line}</span>
              </span>
              <ChevronDown aria-hidden="true" className="iv-more__chev" />
            </button>
            {open === sid && (
              <div id={`${sid}-panel`} className="iv-more__panel">
                {sid === 'lbo' ? <PaperLboDrill /> : sid === 'pitch' ? <Pitch /> : sid === 'calls' ? <Calls /> : sid === 'calendar' ? <Calendar /> : <Resources />}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}

const eur = (n: number) => `€${Math.round(n).toLocaleString('en')}m`
const times = (n: number) => `${+n.toFixed(2)}×`
/** "2.5", "2.5x", "2,5×" → 2.5; "20", "20%" → 20. */
const num = (s: string) => parseNumber(s.replace(/[x×]$/i, ''))

function PaperLboDrill() {
  const [seed, setSeed] = useState(() => Date.now())
  const [mom, setMom] = useState('')
  const [irr, setIrr] = useState('')
  const [checked, setChecked] = useState(false)
  const d = paperLbo(seed)
  const a = solveLbo(d)
  const m = num(mom)
  const i = num(irr)
  const ok = checked && m !== null && i !== null ? lboClose(a, m, i) : null

  const next = () => (setSeed(Date.now()), setMom(''), setIrr(''), setChecked(false))

  return (
    <div className="iv-section">
      <p className="prep__lede">A sponsor buys the company and sells it after {d.years} years. All free cash flow repays debt. What are the money multiple and the IRR?</p>
      <dl className="ib-facts tnum">
        <dt>Entry</dt>
        <dd>
          {eur(d.ebitda)} EBITDA at {d.entry}×
        </dd>
        <dt>Debt</dt>
        <dd>{d.debtPct}% of the price</dd>
        <dt>EBITDA in year {d.years}</dt>
        <dd>{eur(d.exitEbitda)}</dd>
        <dt>Debt repaid</dt>
        <dd>{eur(d.repaid)} over the period</dd>
        <dt>Exit</dt>
        <dd>at {d.exit}× EBITDA</dd>
      </dl>
      <form
        className="ib-answer"
        onSubmit={(e) => {
          e.preventDefault()
          setChecked(true)
        }}
      >
        <label className="field">
          <span className="label">Money multiple</span>
          <input className="field__input tnum" inputMode="decimal" placeholder="2.5×" value={mom} onChange={(e) => (setMom(e.target.value), setChecked(false))} />
        </label>
        <label className="field">
          <span className="label">IRR</span>
          <input className="field__input tnum" inputMode="decimal" placeholder="20%" value={irr} onChange={(e) => (setIrr(e.target.value), setChecked(false))} />
        </label>
        <button type="submit" className="btn btn--primary" disabled={m === null || i === null}>
          Check
        </button>
      </form>
      {ok && (
        <div className="iv-feedback" aria-live="polite">
          <p className="iv-result ib-verdict tnum">
            <span>{ok.mom ? <Check aria-label="Right" className="iv-ok" /> : <X aria-label="Off" className="iv-miss" />} {times(a.mom)} money multiple</span>
            <span>{ok.irr ? <Check aria-label="Right" className="iv-ok" /> : <X aria-label="Off" className="iv-miss" />} {a.irr.toFixed(1)}% IRR</span>
          </p>
          <ol className="iv-list tnum">
            <li>
              Price {eur(d.ebitda)} × {d.entry} = {eur(a.price)}. Debt {eur(a.debt)}, so equity {eur(a.equity)}.
            </li>
            <li>
              Exit value {eur(d.exitEbitda)} × {d.exit} = {eur(a.exitEv)}.
            </li>
            <li>
              Debt left {eur(a.debt)} − {eur(d.repaid)} = {eur(a.exitDebt)}, so equity at exit {eur(a.exitEquity)}.
            </li>
            <li>
              Multiple {eur(a.exitEquity)} ÷ {eur(a.equity)} = {times(a.mom)}. Over five years 2× ≈ 15%, 2.5× ≈ 20%, 3× ≈ 25%.
            </li>
          </ol>
          <button type="button" className="btn iv-start-btn" onClick={next}>
            New deal
          </button>
        </div>
      )}
      {!ok && (
        <button type="button" className="iv-link ib-skip" onClick={next}>
          Give me another deal
        </button>
      )}
    </div>
  )
}

function Pitch() {
  const [text, setText] = useStored<Partial<Record<PitchPart, string>>>('ib-pitch', {})
  const secs = pitchSeconds(Object.values(text).join(' '))
  const [lo, hi] = PITCH_RANGE
  return (
    <div className="iv-section">
      {PITCH_PARTS.map(([id, label, hint]) => (
        <label key={id} className="field">
          <span className="label">{label}</span>
          <span className="prep__meta">{hint}</span>
          <textarea className="field__input" rows={id === 'experiences' ? 6 : 2} value={text[id] ?? ''} onChange={(e) => setText({ ...text, [id]: e.target.value })} />
        </label>
      ))}
      <p className="prep__meta tnum" aria-live="polite">
        {secs === 0 ? `Aim for ${lo}–${hi} seconds spoken.` : `About ${secs} seconds spoken. ${secs < lo ? 'Room to add a detail.' : secs > hi ? 'Cut to the strongest experiences.' : 'Good length.'}`} Saved in this browser.
      </p>
      <Link href="/prepare/interviews#mock" className="btn iv-start-btn">
        Rehearse it out loud
      </Link>
    </div>
  )
}

function Calls() {
  return (
    <div className="iv-section">
      <ol className="ib-steps">
        {CALL_STEPS.map(([title, body]) => (
          <li key={title}>
            <span className="iv-more__title">{title}</span>
            <span className="iv-more__line">{body}</span>
          </li>
        ))}
      </ol>
      <div className="ib-cols">
        {CALL_QUESTIONS.map(([title, qs]) => (
          <div key={title}>
            <h4 className="label">{title}</h4>
            <ul className="iv-list">
              {qs.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="prep__meta">{CALL_AVOID}</p>
      <Link href="/contacts" className="btn iv-start-btn">
        Find bankers to call
      </Link>
    </div>
  )
}

function Calendar() {
  return (
    <div className="iv-section">
      <dl className="ib-facts">
        {CALENDAR.map(([when, what]) => (
          <div key={when} className="ib-facts__row">
            <dt>{when}</dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h4 className="label">The rounds</h4>
        <ol className="iv-list">
          {ROUNDS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </div>
      <div className="posting__actions">
        <Link href="/jobs" className="btn btn--primary btn--sm">
          Find internships
        </Link>
        <Link href="/prepare" className="btn btn--sm">
          Practise online tests
        </Link>
      </div>
    </div>
  )
}

function Resources() {
  return (
    <div className="iv-section">
      <ol className="iv-list">
        {PATH.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      {RESOURCES.map(([group, items]) => (
        <div key={group}>
          <h4 className="label">{group}</h4>
          <ul className="ib-links">
            {items.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.name}
                </a>
                <span className="iv-more__line">{r.line}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
