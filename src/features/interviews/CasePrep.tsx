// /prepare/interviews/case: consulting case interviews. One primary action (run a full case), where you stand across the five scored
// dimensions, then quiet entries for drills, how to prepare and where to practise. No model call; history stays in this browser.
import { useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { Link } from 'wouter'
import { Check, ChevronDown, ChevronLeft, ExternalLink, X } from 'lucide-react'
import { CASES, DIMENSIONS, READY_CASES, ROUND_SEC, checkCaseMaths, daysThisWeek, inThisWeek, mathsScore, readiness, weakest, type Case, type CaseLog, type Dimension, type Scores } from '../../../shared/case-library'
import { fmt } from '../../../shared/case-kit'
import { DataView } from '../assessments/games/NumericalData'
import { CaseKit } from './CaseKit'
import { Segmented } from './Segmented'
import { clock, useElapsed, useHashSection, useStored } from './useStored'
import '../assessments/assessments.css'
import './interviews.css'
import './case.css'

const ROUNDS = Object.keys(DIMENSIONS) as Dimension[]
const FORMATS = [
  ['interviewer', 'Interviewer-led'],
  ['candidate', 'Candidate-led'],
] as const
type Format = (typeof FORMATS)[number][0]
const FORMAT_HINT: Record<Format, string> = {
  interviewer: 'McKinsey style: the interviewer asks each question and hands you the data.',
  candidate: 'BCG and Bain style: you drive, and ask for the data you need before you see it.',
}
const SCORE_OPTIONS = ['1', '2', '3', '4', '5'].map((n) => [n, n] as const)
const FIX_HINT: Record<Dimension, string> = {
  structure: 'e.g. Build my own buckets for the question instead of a stock framework',
  insight: 'e.g. Say the so-what of an exhibit before reading out numbers',
  maths: 'e.g. Write the equation before computing',
  creativity: 'e.g. Group ideas into buckets before listing them',
  synthesis: 'e.g. Lead with the answer, then two reasons with numbers',
}
const SECTIONS = [
  ['drills', 'Drills', 'Mental maths, market sizing, frameworks'],
  ['plan', 'How to prepare', 'Weekly routine and what each firm asks'],
  ['resources', 'Where to practise', 'Courses, official cases, partners, open source'],
] as const
type Section = (typeof SECTIONS)[number][0]

export function CasePrep() {
  const [log, setLog] = useStored<CaseLog[]>('case-log', [])
  const [drills] = useStored<{ at: string }[]>('case-maths', [])
  const [caseId, setCaseId] = useState(() => CASES.find((c) => !log.some((l) => l.id === c.id))?.id ?? CASES[0]!.id)
  const [format, setFormat] = useState<Format>('interviewer')
  const [running, setRunning] = useState(false)
  const [open, toggle] = useHashSection<Section>(SECTIONS.map(([id]) => id))
  const c = CASES.find((x) => x.id === caseId)!
  const save = (entry: CaseLog) => setLog([entry, ...log].slice(0, 200))

  return (
    <main className="map interviews">
      <div className="ib-head">
        <Link href="/prepare/interviews" className="ib-back">
          <ChevronLeft aria-hidden="true" />
          Interviews
        </Link>
        <h2 className="ib-title">Consulting cases</h2>
        <p className="prep__lede">Interviewers score five things: structure, exhibits, maths, brainstorming and the recommendation. Practise each round, out loud, and fix one habit per case.</p>
      </div>

      <section className="iv-start" aria-labelledby="case-run-title">
        <h3 id="case-run-title" className="iv-start__title">
          Run a case
        </h3>
        {running ? (
          <CaseRun
            key={`${c.id}-${format}`}
            c={c}
            format={format}
            onExit={() => setRunning(false)}
            onSave={(entry) => {
              save(entry)
              setRunning(false)
              const next = CASES[(CASES.indexOf(c) + 1) % CASES.length]!
              setCaseId(next.id)
            }}
          />
        ) : (
          <>
            <p className="prep__meta">Five timed rounds, about 20 minutes. Say each answer out loud, then type the gist.</p>
            <label className="field">
              <span className="label">Case</span>
              <select className="field__input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                {CASES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title} · {x.kind}
                    {log.some((l) => l.id === x.id) ? ' · done' : ''}
                  </option>
                ))}
              </select>
            </label>
            <Segmented label="Case format" options={FORMATS} value={format} onChange={setFormat} />
            <p className="prep__meta">{FORMAT_HINT[format]}</p>
            <button type="button" className="btn btn--primary iv-start-btn" onClick={() => setRunning(true)}>
              Start case
            </button>
          </>
        )}
      </section>

      <Standing log={log} drills={drills} onLog={save} onFix={(at) => setLog(log.map((l) => (l.at === at ? { ...l, fixed: true } : l)))} />

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
                {sid === 'drills' ? <CaseKit /> : sid === 'plan' ? <Plan /> : <Resources />}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}

// ---- One case, round by round ----

type Stage = 'brief' | Dimension | 'debrief'

function CaseRun({ c, format, onExit, onSave }: { c: Case; format: Format; onExit: () => void; onSave: (entry: CaseLog) => void }) {
  const [stage, setStage] = useState<Stage>('brief')
  const [text, setText] = useState<Record<string, string>>({})
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const [scores, setScores] = useState<Partial<Scores>>({})
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [mathsSec, setMathsSec] = useState(0)
  const [fix, setFix] = useState('')
  const elapsed = useElapsed(startedAt)
  const field = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  const write = (k: string) => (v: string) => setText({ ...text, [k]: v })
  const show = (k: string) => setShown({ ...shown, [k]: true })
  const go = (next: Stage) => {
    setStage(next)
    setStartedAt(next === 'debrief' || (next === 'insight' && format === 'candidate') ? null : Date.now())
    setTimeout(() => field.current?.focus())
  }
  const reveal = (k: Dimension) => {
    show(k)
    setStartedAt(null)
  }
  const nextOf = (d: Dimension): Stage => ROUNDS[ROUNDS.indexOf(d) + 1] ?? 'debrief'

  if (stage === 'brief')
    return (
      <div className="iv-pane">
        <p className="case__prompt">{c.prompt}</p>
        <Area label="Your clarifying questions" value={text.clarify ?? ''} onChange={write('clarify')} placeholder={'Restate the goal, then ask what you need, e.g.\nWhat does success look like, and by when?'} refEl={field} />
        {shown.clarify ? (
          <ul className="iv-list">
            {c.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : (
          <button type="button" className="btn btn--quiet case__reveal" onClick={() => show('clarify')}>
            Ask the interviewer
          </button>
        )}
        <div className="mock__end">
          <button type="button" className="btn btn--primary" onClick={() => go('structure')}>
            Start structuring
          </button>
          <button type="button" className="btn btn--quiet" onClick={onExit}>
            Leave case
          </button>
        </div>
      </div>
    )

  if (stage === 'debrief') {
    const full = scores as Scores
    const low = weakest(full)
    return (
      <div className="iv-pane">
        <p className="iv-result">Debrief</p>
        <dl className="case__scores">
          {ROUNDS.map((d) => (
            <div key={d} className={d === low ? 'is-low' : undefined}>
              <dt>{DIMENSIONS[d]}</dt>
              <dd className="tnum">{full[d]} / 5</dd>
            </div>
          ))}
        </dl>
        <p className="prep__meta">Weakest round: {DIMENSIONS[low].toLowerCase()}. Fixing one habit per case beats running more cases.</p>
        <label className="field">
          <span className="label">One thing to fix next time</span>
          <input className="field__input" value={fix} onChange={(e) => setFix(e.target.value)} placeholder={FIX_HINT[low]} />
        </label>
        <div className="mock__end">
          <button type="button" className="btn btn--primary" onClick={() => onSave({ id: c.id, at: new Date().toISOString(), title: c.title, source: 'solo', scores: full, fix: fix.trim() })}>
            Save to your log
          </button>
          <button type="button" className="btn btn--quiet" onClick={onExit}>
            Discard
          </button>
        </div>
      </div>
    )
  }

  const d = stage
  const n = ROUNDS.indexOf(d) + 1
  const limit = ROUND_SEC[d]
  const over = limit > 0 && elapsed >= limit
  const scored = scores[d] !== undefined
  const needsAsk = d === 'insight' && format === 'candidate' && !shown.ask
  const footer = (
    <>
      {d !== 'maths' && shown[d] && (
        <div className="field">
          <span className="label">How did you do? 3 is what an average real candidate does.</span>
          <Segmented label={`Score your ${DIMENSIONS[d].toLowerCase()}`} options={SCORE_OPTIONS} value={String(scores[d] ?? '') as (typeof SCORE_OPTIONS)[number][0]} onChange={(v) => setScores({ ...scores, [d]: Number(v) })} />
        </div>
      )}
      {scored && (
        <button type="button" className="btn btn--primary iv-start-btn" onClick={() => go(nextOf(d))}>
          {nextOf(d) === 'debrief' ? 'See debrief' : 'Next round'}
        </button>
      )}
    </>
  )

  return (
    <div className="iv-pane">
      <div className="practice__bar">
        <span className="label tnum">
          {DIMENSIONS[d]} · {n} of {ROUNDS.length}
        </span>
        {startedAt !== null && <span className={`practice__clock tnum${over ? ' case__over' : ''}`}>{limit ? (over ? `Time · +${clock(elapsed - limit)}` : clock(limit - elapsed)) : clock(elapsed)}</span>}
      </div>
      <details className="case__brief">
        <summary>{c.title}</summary>
        <p>{c.prompt}</p>
      </details>

      {d === 'structure' && (
        <>
          <p className="mock__question">How would you break this problem down?</p>
          <Area label="Your structure" value={text.structure ?? ''} onChange={write('structure')} placeholder={'Three or four buckets, each with what you would look at'} refEl={field} disabled={shown.structure} />
          {shown.structure ? <Reference title="One good structure"><dl className="iv-dl">{c.structure.map((b) => <div key={b.name}><dt>{b.name}</dt><dd>{b.points}</dd></div>)}</dl></Reference> : <RevealButton onClick={() => reveal('structure')} />}
        </>
      )}

      {d === 'insight' &&
        (needsAsk ? (
          <>
            <p className="mock__question">What data would you ask for next, and why?</p>
            <Area label="Your request" value={text.ask ?? ''} onChange={write('ask')} placeholder="e.g. Price and volume for both years, to see which one moved" refEl={field} />
            <button type="button" className="btn btn--primary iv-start-btn" onClick={() => { show('ask'); setStartedAt(Date.now()) }}>
              Ask for it
            </button>
          </>
        ) : (
          <>
            <div className="case__exhibit"><DataView data={c.exhibit} /></div>
            <p className="mock__question">What stands out, and why does it matter?</p>
            <Area label="Your reading" value={text.insight ?? ''} onChange={write('insight')} placeholder="The so-what first, then the numbers behind it" refEl={field} disabled={shown.insight} />
            {shown.insight ? <Reference title="What to notice"><p>{c.insight}</p></Reference> : <RevealButton onClick={() => reveal('insight')} />}
          </>
        ))}

      {d === 'maths' && (
        <MathsRound
          c={c}
          refEl={field}
          onDone={(right, answered) => {
            setMathsSec(elapsed)
            setStartedAt(null)
            setScores({ ...scores, maths: mathsScore(right, elapsed, answered) })
          }}
          sec={mathsSec}
          score={scores.maths}
        />
      )}

      {d === 'creativity' && (
        <>
          <p className="mock__question">{c.brainstorm.question}</p>
          <Area label="Your ideas" value={text.creativity ?? ''} onChange={write('creativity')} placeholder="Group them: e.g. revenue ideas, then cost ideas" refEl={field} disabled={shown.creativity} />
          {shown.creativity ? <Reference title="Ideas an interviewer would hope for"><ul className="iv-list">{c.brainstorm.ideas.map((i) => <li key={i}>{i}</li>)}</ul></Reference> : <RevealButton onClick={() => reveal('creativity')} />}
        </>
      )}

      {d === 'synthesis' && (
        <>
          <p className="mock__question">The CEO walks in and asks for your answer. You have a minute.</p>
          <Area label="Your recommendation" value={text.synthesis ?? ''} onChange={write('synthesis')} placeholder="Answer first. Two reasons with numbers. One risk. A next step." refEl={field} disabled={shown.synthesis} />
          {shown.synthesis ? (
            <Reference title="A strong answer">
              <p>{c.recommendation}</p>
              <p className="prep__meta">Check yours: answer first · reasons with numbers · a risk · a next step.</p>
            </Reference>
          ) : (
            <RevealButton onClick={() => reveal('synthesis')} />
          )}
        </>
      )}

      {footer}
    </div>
  )
}

function MathsRound({ c, refEl, onDone, sec, score }: { c: Case; refEl: RefObject<HTMLTextAreaElement | HTMLInputElement | null>; onDone: (right: boolean, answered: boolean) => void; sec: number; score?: number }) {
  const [input, setInput] = useState('')
  const right = score !== undefined && checkCaseMaths(c.maths.answer, input)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim()) onDone(checkCaseMaths(c.maths.answer, input), true)
  }
  const shownAnswer = c.maths.unit === '€' ? `€${fmt(c.maths.answer)}` : `${c.maths.answer}${c.maths.unit === '%' || c.maths.unit === '×' ? c.maths.unit : ` ${c.maths.unit}`}`
  return (
    <>
      <div className="case__exhibit"><DataView data={c.exhibit} /></div>
      <form className="iv-pane" onSubmit={submit}>
        <p className="mock__question">{c.maths.question}</p>
        <p className="prep__meta">No calculator. Say the equation before you compute.</p>
        <div className="iv-answer">
          <input ref={refEl as RefObject<HTMLInputElement>} className="field__input" inputMode="decimal" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Your answer" placeholder="e.g. 1.2m, 350k or 12.5" disabled={score !== undefined} />
          {score === undefined && (
            <button type="submit" className="btn btn--primary">
              Answer
            </button>
          )}
        </div>
        {score === undefined && (
          <button type="button" className="btn btn--quiet case__reveal" onClick={() => onDone(false, false)}>
            Show the working
          </button>
        )}
      </form>
      {score !== undefined && (
        <div className="iv-feedback" role="status">
          <p className="iv-result tnum case__verdict">
            {right ? <Check aria-hidden="true" className="iv-ok" /> : <X aria-hidden="true" className="iv-miss" />} {right ? 'Right' : 'Not quite'}: about {shownAnswer}
            {sec > 0 && ` · ${clock(sec)}`}
          </p>
          <p className="prep__meta">{c.maths.working}</p>
          <p className="prep__meta tnum">Scored {score} of 5: right within 75 seconds is a 5, right but slower a 4.</p>
        </div>
      )}
    </>
  )
}

function Area({ label, value, onChange, placeholder, refEl, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; refEl: RefObject<HTMLTextAreaElement | HTMLInputElement | null>; disabled?: boolean }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <textarea ref={refEl as RefObject<HTMLTextAreaElement>} className="field__input" rows={4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly={disabled} />
    </label>
  )
}

const RevealButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="btn btn--quiet case__reveal" onClick={onClick}>
    Compare with a strong answer
  </button>
)

const Reference = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="case__ref" role="status">
    <p className="label">{title}</p>
    {children}
  </div>
)

// ---- Where you stand ----

function Standing({ log, drills, onLog, onFix }: { log: CaseLog[]; drills: { at: string }[]; onLog: (e: CaseLog) => void; onFix: (at: string) => void }) {
  const [logging, setLogging] = useState(false)
  const r = readiness(log)
  const liveWeek = log.filter((l) => l.source === 'live' && inThisWeek(l.at)).length
  const drillDays = daysThisWeek(drills.map((d) => d.at))
  const fixes = log.filter((l) => l.fix && !l.fixed).slice(0, 5)

  return (
    <section className="case__standing" aria-labelledby="case-standing-title">
      <h3 id="case-standing-title" className="iv-start__title">
        Where you stand
      </h3>
      <p className="case__line">{r.line}</p>
      <p className="prep__meta tnum">
        {r.count} of {READY_CASES} cases · {r.live} with a partner · this week {liveWeek} of 3 live cases, drills on {drillDays} of 7 days
      </p>
      {r.count > 0 && (
        <dl className="case__scores" aria-label="Average of your last five cases">
          {ROUNDS.map((d) => (
            <div key={d} className={r.avg[d] < 3 ? 'is-low' : undefined}>
              <dt>{DIMENSIONS[d]}</dt>
              <dd className="tnum">{r.avg[d].toFixed(1)}</dd>
            </div>
          ))}
        </dl>
      )}
      {fixes.length > 0 && (
        <div className="field">
          <span className="label">Open fixes</span>
          <ul className="case__fixes">
            {fixes.map((f) => (
              <li key={f.at}>
                <span>{f.fix}</span>
                <button type="button" className="btn btn--quiet" onClick={() => onFix(f.at)} aria-label={`Mark fixed: ${f.fix}`}>
                  <Check aria-hidden="true" /> Fixed
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {logging ? (
        <LiveCaseForm
          onCancel={() => setLogging(false)}
          onSave={(e) => {
            onLog(e)
            setLogging(false)
          }}
        />
      ) : (
        <button type="button" className="btn iv-start-btn" onClick={() => setLogging(true)}>
          Log a case with a partner
        </button>
      )}
    </section>
  )
}

function LiveCaseForm({ onSave, onCancel }: { onSave: (e: CaseLog) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [scores, setScores] = useState<Partial<Scores>>({})
  const [fix, setFix] = useState('')
  const complete = ROUNDS.every((d) => scores[d] !== undefined)
  return (
    <form
      className="iv-pane"
      onSubmit={(e) => {
        e.preventDefault()
        if (complete) onSave({ id: 'live', at: new Date().toISOString(), title: title.trim() || 'Live case', source: 'live', scores: scores as Scores, fix: fix.trim() })
      }}
    >
      <label className="field">
        <span className="label">Case</span>
        <input className="field__input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bain coffee shop, with a classmate" />
      </label>
      <fieldset className="iv-grid">
        <legend className="label">Your partner's scores, 1 to 5. Mark a round 3 if it did not come up.</legend>
        {ROUNDS.map((d) => (
          <div key={d} className="iv-grid__row">
            <span>{DIMENSIONS[d]}</span>
            <Segmented label={DIMENSIONS[d]} options={SCORE_OPTIONS} value={String(scores[d] ?? '') as (typeof SCORE_OPTIONS)[number][0]} onChange={(v) => setScores({ ...scores, [d]: Number(v) })} />
          </div>
        ))}
      </fieldset>
      <label className="field">
        <span className="label">One thing to fix next time</span>
        <input className="field__input" value={fix} onChange={(e) => setFix(e.target.value)} placeholder="What your partner would tell you first" />
      </label>
      <div className="mock__end">
        <button type="submit" className="btn btn--primary" disabled={!complete}>
          Save case
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---- How to prepare ----

const FIRMS: { name: string; format: string; url: string; link: string }[] = [
  { name: 'McKinsey', format: 'Solve, a game McKinsey says needs no preparation. Then interviewer-led cases with numbered questions, and a Personal Experience Interview: one story told in depth.', url: 'https://www.mckinsey.com/careers/interviewing', link: 'Four official sample cases' },
  { name: 'BCG', format: 'Cases where you structure, ask for data, analyse and calculate; mostly candidate-led. Some offices send an online chatbot case first, ending in a recorded one-minute recommendation.', url: 'https://careers.bcg.com/global/en/case-interview-preparation', link: 'Official case tips' },
  { name: 'Bain', format: 'An online test first (Sova or TestGorilla; your invite says which). Then conversational, candidate-led cases with no calculator.', url: 'https://www.bain.com/careers/hiring-process/case-interview/', link: 'Coffee shop and fashion sample cases' },
]

function Plan() {
  return (
    <div className="iv-pane">
      <ul className="iv-list">
        <li>Three live cases a week with a partner, and no more than four: the debrief matters more than the volume.</li>
        <li>Fifteen minutes a day of mental maths or structuring, from the first day.</li>
        <li>After every case, score the five rounds and write one thing to fix. Work on that habit in the next case.</li>
        <li>Around 30 cases before your interviews, at least half of them live, usually over four to eight weeks.</li>
        <li>Practise out loud. Reading cases and watching videos does not train the talking.</li>
        <li>
          Prepare three to five fit stories alongside: leadership, impact, teamwork, a setback. <Link href="/prepare/interviews#stories">Your story bank</Link>
        </li>
      </ul>
      {FIRMS.map((f) => (
        <div key={f.name} className="iv-fold">
          <p className="iv-more__title">{f.name}</p>
          <p className="prep__meta">{f.format}</p>
          <ExtLink href={f.url}>{f.link}</ExtLink>
        </div>
      ))}
    </div>
  )
}

// ---- Where to practise ----

type Res = { name: string; url: string; note: string }
const RESOURCES: { group: string; items: Res[] }[] = [
  {
    group: 'Learn for free',
    items: [
      { name: 'Crafting Cases', url: 'https://www.craftingcases.com/free-course-hp/', note: 'Seven-day course on building your own issue trees instead of memorised frameworks. The best free start.' },
      { name: 'Firm sample cases', url: 'https://www.mckinsey.com/careers/interviewing', note: 'McKinsey, BCG and Bain each publish what they expect; links are under How to prepare.' },
    ],
  },
  {
    group: 'Paid, if you want more',
    items: [
      { name: 'CaseCoach', url: 'https://casecoach.com', note: 'Courses, recorded interviews, maths drills, 100+ cases and a peer practice room. About €43 a month or €172 a year; one or two months covers a focused run.' },
      { name: 'PrepLounge Premium', url: 'https://www.preplounge.com/en/pricing.php', note: 'Best value if you mainly need partners: unlimited peer mocks, cases and drills. €79 once for a year; from €199 with a coaching session.' },
      { name: 'RocketBlocks', url: 'https://www.rocketblocks.me/consulting.php', note: 'Chart, maths and structuring drills. $35 a month or $155 a year.' },
    ],
  },
  {
    group: 'Open source',
    items: [
      { name: 'ConsultingTrainer', url: 'https://github.com/bakulbadwal/consultingtrainer', note: 'One HTML file: timed full cases, profit diagnosis, exhibits, maths, PE due-diligence drills. MIT. Its scoring is not validated.' },
      { name: 'consultant', url: 'https://github.com/yoichiojima-2/consultant', note: 'Claude Code plugin: /case-practice runs a mock case with exhibits and a scored debrief. MIT; uses your AI subscription.' },
      { name: 'case-interview-coach', url: 'https://github.com/ShuchangZhang/case-interview-coach', note: 'AI agent skill with interview and tutorial modes and a six-dimension rubric. MIT.' },
      { name: 'Real Mock Interview Agent', url: 'https://github.com/ameliapeng-gif/real-mock-interview-agent', note: 'Researches the firm first, then runs a case and writes a debrief. MIT; voice needs a MiniMax key.' },
      { name: 'Management Consultant skill', url: 'https://github.com/DogInfantry/claude-skill-management-consultant-B1', note: 'Large reference on issue trees, case maths, charts and fit. Apache-2.0.' },
      { name: 'math-arena', url: 'https://github.com/snowwhiteman42/math-arena', note: 'Adaptive timed mental-maths drills. MIT.' },
    ],
  },
]

function Resources() {
  return (
    <div className="iv-pane">
      <p className="prep__lede">Free first: Crafting Cases, then the firms' own cases, then live practice with classmates. Ask your career service whether it already pays for a platform before you buy one.</p>
      {RESOURCES.map((g) => (
        <div key={g.group} className="case__res">
          <p className="label">{g.group}</p>
          <ul className="case__res-list">
            {g.items.map((r) => (
              <li key={r.name}>
                <ExtLink href={r.url}>{r.name}</ExtLink>
                <span className="prep__meta">{r.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="prep__meta">AI scores from these tools have not been shown to predict offers. Use a person's feedback to judge when you are ready.</p>
    </div>
  )
}

const ExtLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="case__link">
    {children}
    <ExternalLink aria-hidden="true" />
  </a>
)
