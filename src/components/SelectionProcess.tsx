import { AiWorking } from '@/components/AiWorking'
import { REVIEW_STEPS } from '@/lib/ai-wait'
import { useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { Check, Clock, ExternalLink, X } from 'lucide-react'
import type { AssessmentSource } from '../../shared/assessments'
import type { SourcedTip } from '../../shared/selection'
import { SaveStory, StoriesForPosting } from './StoryBank'
import { ANSWER_TEXT_LIMIT, type AnswerFeedback, type PracticeAnswer } from '../../shared/interview'
import type { Job } from '../../shared/types'
import { api, isAbort, type Me } from '../lib/api'
import { useAbortable, useResource } from '../lib/hooks'
import { ErrorNote } from './ErrorNote'
import posthog from '../lib/posthog'
import { PrepGhost } from './PrepGhost'
import { FreeModelNote } from './FreeModelNote'
import '../features/assessments/assessments.css'

const SOURCE_ORDER: AssessmentSource['kind'][] = ['official', 'university', 'candidate report', 'forum', 'provider']
// A round that is an online test gets a pointer to the drills.
const ONLINE_TEST = /online (test|assessment)|psychometric|numerical|verbal|logical|aptitude|game|hirevue|pymetrics|situational judg/i
// Other rounds point to the matching section of the interview hub.
const ROUND_PRACTICE: [RegExp, string, string][] = [
  [/case/i, 'case', 'Practise case interviews'],
  [/assessment (cent|day)|superday|super day|group|in-?tray|e-?tray|presentation/i, 'assessment-centre', 'Prepare for this in the assessment centre kit'],
  [/technical/i, 'technicals', 'Revise technical questions'],
  [/interview|video|phone|call|screen/i, 'mock', 'Rehearse this interview'],
]

const monthYear = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export function SelectionProcess({ job, me, onSpend }: { job: Job; me: Me; onSpend: () => Promise<void> }) {
  const res = useResource(() => api.jobSelection(job.id), [job.id])
  // Newest attempt first, so the first match per question is its last try.
  const practice = useResource(() => api.practiceAnswers(job.id), [job.id])
  const lastTry = (question: string) => practice.data?.answers.find((a) => a.question === question) ?? null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exhausted = me.budget.used >= me.budget.limit

  const research = async () => {
    setBusy(true)
    setError(null)
    try {
      const { selection } = await api.researchSelection(job.id)
      posthog.capture('selection_researched', { found: Boolean(selection?.stages.length), confidence: selection?.confidence ?? null })
      res.setData({ selection })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not research this process')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  if (res.loading && !res.data) return <PrepGhost title="Hiring rounds" lines={2} status="Looking up the selection process…" />
  if (res.error) return <ErrorNote text={res.error} />

  const s = res.data?.selection ?? null
  const researchButton = (label: string) => (
    <>
      <button type="button" className={s ? 'btn btn--quiet' : 'btn btn--ink'} onClick={() => void research()} disabled={busy || exhausted} aria-busy={busy}>
        {busy ? 'Researching…' : label}
      </button>
      {busy && <AiWorking steps={['Searching public sources', 'Reading what candidates report', 'Laying out the selection process']} expected={30} shape="lines" />}
      {exhausted && (
        <p className="notice" role="status">
          <Clock aria-hidden="true" />
          <span>Monthly budget used up. See <Link href="/profile">Profile</Link> for the reset date.</span>
        </p>
      )}
    </>
  )

  if (!s)
    return (
      <div className="prep">
        {error && <ErrorNote text={error} />}
        <section className="posting__block" aria-labelledby="sel-none">
          <h3 id="sel-none" className="label">
            Hiring rounds
          </h3>
          <p className="prep__lede">See how {job.company} hires, round by round, from public reviews. Every point links to its source.</p>
          {researchButton('Research the process')}
        </section>
      </div>
    )

  const sources = [...s.sources].sort((x, y) => SOURCE_ORDER.indexOf(x.kind) - SOURCE_ORDER.indexOf(y.kind))
  const cite = (url: string) => {
    const n = sources.findIndex((x) => x.url === url) + 1
    return n ? (
      <a key={url} className="sel__cite" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Source ${n}: ${sources[n - 1]!.title}`}>
        [{n}]
      </a>
    ) : null
  }

  return (
    <div className="prep">
      {error && <ErrorNote text={error} />}
      <section className="posting__block" aria-labelledby="sel-rounds">
        <div className="prep__head">
          <h3 id="sel-rounds" className="label">
            The rounds
          </h3>
          <span className={`prep__tag prep__tag--${s.confidence}`}>{s.confidence[0]!.toUpperCase() + s.confidence.slice(1)} confidence</span>
        </div>
        {s.stages.length ? (
          <ol className="sel__stages">
            {s.stages.map((st, i) => (
              <li key={i}>
                <p className="sel__stage-name">
                  {st.name} {st.sourceUrls.map(cite)}
                </p>
                <p className="prep__meta">
                  {st.format}
                  {st.duration && ` · ${st.duration}`}
                </p>
                {st.whatTheyAssess && <p>Tests: {st.whatTheyAssess}</p>}
                {st.tips.length > 0 && (
                  <ul className="sel__tips">
                    {st.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                <RoundPractice job={job} text={`${st.name} ${st.format}`} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="prep__lede">The sources found do not describe the rounds for this role.</p>
        )}
        <dl className="dims">
          {s.timeline && <Row label="Timeline" value={s.timeline} />}
          {s.difficulty && <Row label="Difficulty" value={s.difficulty} />}
          {s.values.length > 0 && <Row label="What they look for" value={s.values.join(', ')} />}
          <Row label="Last verified" value={monthYear(s.sourceDate)} />
        </dl>
        {s.notes && (
          <details className="req__fold">
            <summary className="prep__meta">What the search found</summary>
            <p className="prep__meta">{s.notes}</p>
          </details>
        )}
      </section>

      <Tips id="sel-advice" title="Advice from people who went through it" tips={s.advice} cite={cite} />
      <Tips id="sel-pitfalls" title="Pitfalls and surprises" tips={s.pitfalls} cite={cite} />

      {s.questions.length > 0 && (
        <section className="posting__block" aria-labelledby="sel-questions">
          <h3 id="sel-questions" className="label">
            Questions candidates were asked
          </h3>
          <ul className="sel__tips">
            {s.questions.map((q) => (
              <li key={q.question}>
                {q.question} {q.stage && <span className="prep__meta">({q.stage})</span>} {cite(q.sourceUrl)}
                {/* Remounts once stored attempts arrive, so it opens on the last try. */}
                <Practice key={practice.data ? 'loaded' : 'loading'} job={job} me={me} question={q.question} last={lastTry(q.question)} disabled={exhausted} onSpend={onSpend} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <StoriesForPosting job={job} />

      <section className="posting__block" aria-labelledby="sel-sources">
        {/* The reading list backs the points above; it opens on demand. */}
        {sources.length > 0 ? (
          <details className="posting__fold">
            <summary id="sel-sources" className="label">Sources · {sources.length}</summary>
            <ol className="prep__sources">
              {sources.map((x) => (
                <li key={x.url}>
                  <a href={x.url} target="_blank" rel="noopener noreferrer">
                    {x.title} <ExternalLink aria-hidden="true" />
                  </a>
                  <span className="prep__meta"> {x.kind}</span>
                </li>
              ))}
            </ol>
            <p className="booth__model">Reviews and forum posts are one person's experience and may be dated. Open the source before you rely on a point.</p>
          </details>
        ) : (
          <h3 id="sel-sources" className="sr-only">Sources</h3>
        )}
        {researchButton('Research again')}
      </section>
    </div>
  )
}

function Tips({ id, title, tips, cite }: { id: string; title: string; tips: SourcedTip[]; cite: (url: string) => ReactNode }) {
  if (!tips.length) return null
  return (
    <section className="posting__block" aria-labelledby={id}>
      <h3 id={id} className="label">
        {title}
      </h3>
      <ul className="sel__tips">
        {tips.map((t) => (
          <li key={t.tip}>
            {t.tip} {cite(t.sourceUrl)}
          </li>
        ))}
      </ul>
    </section>
  )
}

function RoundPractice({ job, text }: { job: Job; text: string }) {
  if (ONLINE_TEST.test(text))
    return (
      <p className="prep__meta">
        <a href="#online-test">Practise for this test</a> below.
      </p>
    )
  const hit = ROUND_PRACTICE.find(([re]) => re.test(text))
  return hit ? (
    <p className="prep__meta">
      <Link href={hit[1] === 'case' ? '/prepare/interviews/case' : `/prepare/interviews?job=${job.id}#${hit[1]}`}>{hit[2]}</Link>
    </p>
  ) : null
}

const STAR = ['situation', 'task', 'action', 'result'] as const

/** Practise one reported question: write an answer, get STAR feedback and a tighter version. Attempts are stored; the last one shows again. */
function Practice({ job, me, question, last, disabled, onSpend }: { job: Job; me: Me; question: string; last: PracticeAnswer | null; disabled: boolean; onSpend: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  // The question being answered: the reported one, or the follow-up the last feedback asked.
  const [q, setQ] = useState(question)
  const [answer, setAnswer] = useState(last?.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(last?.feedback ?? null)
  const abort = useAbortable()

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const { feedback: f } = await api.answerFeedback(job.id, q, answer, abort.start())
      posthog.capture('answer_practiced', { star: STAR.filter((k) => f.star[k]).length })
      setFeedback(f)
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : 'Could not review the answer')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  return (
    <div className="sel__practice">
      <button type="button" className="btn btn--sm btn--quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : last ? 'Rehearse answer · last try saved' : 'Rehearse answer'}
      </button>
      {open && (
        <>
          {q !== question && <p className="mock__question">{q}</p>}
          <textarea className="field__input" rows={6} maxLength={ANSWER_TEXT_LIMIT} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label={`Your answer to: ${q}`} placeholder="Write your answer as you would say it" />
          <button type="button" className="btn btn--sm" onClick={() => void submit()} disabled={busy || disabled || answer.trim().length < 20} aria-busy={busy}>
            {busy ? 'Reviewing…' : 'Review answer'}
          </button>
          {busy && <AiWorking steps={REVIEW_STEPS} expected={18} shape="lines" onCancel={abort.cancel} />}
          {error && <ErrorNote text={error} />}
          {feedback && <FeedbackView feedback={feedback} />}
          {feedback && <FreeModelNote me={me} className="prep__meta" />}
          {feedback?.tighter && <SaveStory key={q} title={q} text={feedback.tighter} keywords={job.evaluation?.keywords ?? []} />}
          {feedback?.followUp && q === question && (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setQ(feedback.followUp!)
                setAnswer('')
                setFeedback(null)
              }}
            >
              Answer the follow-up
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** STAR ticks, strengths, gaps, earlier gaps now fixed, and the tighter rewrite. */
export function FeedbackView({ feedback }: { feedback: AnswerFeedback }) {
  const lists: [string, string[]][] = [
    ['Fixed since last time', feedback.improved ?? []],
    ['Strengths', feedback.strengths],
    ['Gaps', feedback.gaps],
  ]
  return (
    <>
      <p className="prep__meta prep__star">
        {STAR.map((k) => (
          <span key={k}>
            {feedback.star[k] ? <Check role="img" aria-label="covered" /> : <X role="img" aria-label="missing" />} {k[0]!.toUpperCase() + k.slice(1)}{' '}
          </span>
        ))}
      </p>
      {lists.map(
        ([label, items]) =>
          items.length > 0 && (
            <div key={label}>
              <p className="label">{label}</p>
              <ul className="sel__tips">
                {items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ),
      )}
      <p className="label">Tighter version</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{feedback.tighter}</p>
      <p className="booth__model">Uses only facts from your answer and profile. Check it before you rehearse it.</p>
    </>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
)
