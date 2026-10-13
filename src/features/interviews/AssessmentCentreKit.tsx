// Assessment centre kit, no model: day-of checklist per country, group exercise with a self-scored grid,
// in-tray packs scored against a key, and a timed presentation rehearsal.
import { useState } from 'react'
import { MockInterview } from '../../components/MockInterview'
import { BEHAVIOURS, COUNTRIES, GROUP_BRIEFS, TRAY_ACTIONS, TRAY_PACKS, groupPct, scoreTray, type GroupSession, type TrayAction } from '../../../shared/assessment-centre'
import { PRESENTATION_TOPICS } from '../../../shared/interview-kit'
import { Segmented } from './Segmented'
import { clock, useElapsed, useStored } from './useStored'

const TABS = [
  ['day', 'On the day'],
  ['group', 'Group exercise'],
  ['tray', 'In-tray'],
  ['talk', 'Presentation'],
] as const

export function AssessmentCentreKit() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('day')
  return (
    <div className="iv-section">
      <Segmented label="Assessment centre practice" options={TABS} value={tab} onChange={setTab} />
      {tab === 'day' ? <DayOf /> : tab === 'group' ? <GroupExercise /> : tab === 'tray' ? <InTray /> : <Presentation />}
    </div>
  )
}

function DayOf() {
  const [code, setCode] = useStored('ac-country', 'BE')
  const c = COUNTRIES[code] ?? COUNTRIES.BE!
  const rows: [string, string][] = [
    ['Dress', c.dress],
    ['Arrive', c.punctuality],
    ['How to address people', c.address],
    ['Greeting', c.greeting],
    ['Bring', c.bring],
    ['Travel', c.travel],
  ]
  return (
    <div className="iv-pane">
      <p className="prep__lede">What to wear, bring and expect on the day, by country.</p>
      <label className="field">
        <span className="label">Country</span>
        <select className="field__input" value={code} onChange={(e) => setCode(e.target.value)}>
          {Object.entries(COUNTRIES).map(([id, x]) => (
            <option key={id} value={id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <dl className="iv-dl">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div>
          <dt>Three questions to ask</dt>
          <dd>
            <ol className="iv-list">
              {c.ask.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </dd>
        </div>
      </dl>
      <p className="prep__meta">General norms. The invitation and the recruiter’s instructions always win.</p>
    </div>
  )
}

const LEVELS = ['Not shown', 'Some', 'Clear', 'Strong'] as const

function GroupExercise() {
  const [id, setId] = useState(GROUP_BRIEFS[0]!.id)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [scores, setScores] = useState<number[] | null>(null)
  const [sessions, setSessions] = useStored<GroupSession[]>('ac-group', [])
  const elapsed = useElapsed(startedAt)
  const b = GROUP_BRIEFS.find((x) => x.id === id)!
  const left = b.minutes * 60 - elapsed
  const save = () => {
    setSessions([{ briefId: id, at: new Date().toISOString(), scores: scores! }, ...sessions].slice(0, 30))
    setScores(null)
  }
  const recent = sessions.slice(0, 6).reverse()
  const weakest = sessions.length
    ? BEHAVIOURS.map((label, i) => ({ label, avg: sessions.slice(0, 5).reduce((a, s) => a + (s.scores[i] ?? 0), 0) })).sort((x, y) => x.avg - y.avg)[0]!.label
    : null

  return (
    <div className="iv-pane">
      <p className="prep__lede">A group exercise is a task you solve together while assessors watch. Run it with friends or talk it through alone; they look at how you work with the group, not who wins.</p>
      <label className="field">
        <span className="label">Brief</span>
        <select className="field__input" value={id} onChange={(e) => (setId(e.target.value), setStartedAt(null))}>
          {GROUP_BRIEFS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title} · {x.minutes} min
            </option>
          ))}
        </select>
      </label>
      <p>{b.brief}</p>
      <ul className="iv-list">
        {b.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <p>
        <strong>Task:</strong> {b.task}
      </p>
      <div className="posting__actions">
        {startedAt === null ? (
          <button type="button" className="btn btn--primary" onClick={() => setStartedAt(Date.now())}>
            Start {b.minutes}-minute timer
          </button>
        ) : (
          <>
            <span className={`practice__clock tnum${left < 0 ? ' mock__flag' : ''}`} role="timer">
              {left < 0 ? `+${clock(-left)}` : clock(left)}
            </span>
            <button type="button" className="btn" onClick={() => (setStartedAt(null), setScores(BEHAVIOURS.map(() => 0)))}>
              Finish and score yourself
            </button>
          </>
        )}
        {startedAt === null && !scores && (
          <button type="button" className="btn btn--quiet" onClick={() => setScores(BEHAVIOURS.map(() => 0))}>
            Score a session
          </button>
        )}
      </div>
      {scores && (
        <fieldset className="iv-grid">
          <legend className="label">How often did you…</legend>
          {BEHAVIOURS.map((behaviour, i) => (
            <div key={behaviour} className="iv-grid__row">
              <span>{behaviour}</span>
              <Segmented label={behaviour} options={LEVELS.map((l, n) => [String(n), l] as const)} value={String(scores[i])} onChange={(v) => setScores(scores.map((s, j) => (j === i ? Number(v) : s)))} />
            </div>
          ))}
          <button type="button" className="btn btn--primary iv-start-btn" onClick={save}>
            Save scores
          </button>
        </fieldset>
      )}
      {recent.length > 0 && (
        <p className="prep__meta tnum">
          Your sessions: {recent.map((s) => `${groupPct(s.scores)}%`).join(' → ')}
          {weakest && ` · Work on: ${weakest.toLowerCase()}`}
        </p>
      )}
    </div>
  )
}

function InTray() {
  const [id, setId] = useState(TRAY_PACKS[0]!.id)
  const [answers, setAnswers] = useState<Partial<Record<string, TrayAction>>>({})
  const [doneSec, setDoneSec] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const scored = doneSec !== null
  const elapsed = useElapsed(scored ? null : startedAt)
  const pack = TRAY_PACKS.find((p) => p.id === id)!
  const result = scored ? scoreTray(pack, answers) : null
  const answered = Object.keys(answers).length
  const choose = (next: string) => {
    setId(next)
    setAnswers({})
    setDoneSec(null)
    setStartedAt(null)
  }

  return (
    <div className="iv-pane">
      <p className="prep__lede">An in-tray is a timed inbox exercise: decide what to do with each message, then check your choices against a key.</p>
      <label className="field">
        <span className="label">Pack</span>
        <select className="field__input" value={id} onChange={(e) => choose(e.target.value)}>
          {TRAY_PACKS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <div className="practice__bar">
        <span className="prep__meta">{pack.scene}</span>
        {startedAt !== null && <span className="practice__clock tnum">{clock(doneSec ?? elapsed)}</span>}
      </div>
      <ol className="iv-tray">
        {pack.items.map((it) => {
          const r = result?.items.find((x) => x.item.id === it.id)
          return (
            <li key={it.id}>
              <p>
                <strong>{it.subject}</strong> <span className="prep__meta">· {it.from}</span>
              </p>
              <p className="prep__meta">{it.body}</p>
              <select
                className="field__input iv-tray__pick"
                aria-label={`Action for: ${it.subject}`}
                value={answers[it.id] ?? ''}
                disabled={scored}
                onChange={(e) => {
                  setStartedAt((s) => s ?? Date.now())
                  setAnswers({ ...answers, [it.id]: e.target.value as TrayAction })
                }}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {Object.entries(TRAY_ACTIONS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              {r && r.points < 1 && (
                <p className="prep__meta">
                  <span className="mock__flag">Key: {TRAY_ACTIONS[it.key]}.</span> {it.why}
                </p>
              )}
            </li>
          )
        })}
      </ol>
      {result ? (
        <>
          <p className="iv-result tnum" role="status">
            {result.pct}% right · {result.points} of {pack.items.length} points in {clock(doneSec ?? 0)}
          </p>
          <button type="button" className="btn iv-start-btn" onClick={() => choose(id)}>
            Try again
          </button>
        </>
      ) : (
        <button type="button" className="btn btn--primary iv-start-btn" disabled={answered < pack.items.length} onClick={() => setDoneSec(elapsed)}>
          {answered < pack.items.length ? `${pack.items.length - answered} left to sort` : 'Score my tray'}
        </button>
      )}
    </div>
  )
}

function Presentation() {
  const [topic, setTopic] = useState(PRESENTATION_TOPICS[0]!)
  const [minutes, setMinutes] = useState<'5' | '10'>('5')
  const [go, setGo] = useState(false)
  if (go)
    return (
      <div className="iv-pane">
        <MockInterview key={`${topic}-${minutes}`} mode="presentation" topic={topic} talkSec={Number(minutes) * 60} onExit={() => setGo(false)} />
      </div>
    )
  return (
    <div className="iv-pane">
      <p className="prep__lede">Prepare a short talk, then give it to the clock. You get feedback on your pacing.</p>
      <label className="field">
        <span className="label">Topic</span>
        <select className="field__input" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {PRESENTATION_TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <Segmented
        label="Talk length"
        options={[
          ['5', '5 minutes'],
          ['10', '10 minutes'],
        ]}
        value={minutes}
        onChange={setMinutes}
      />
      <button type="button" className="btn btn--primary iv-start-btn" onClick={() => setGo(true)}>
        Start presentation
      </button>
    </div>
  )
}
