import { AiWorking } from '@/components/AiWorking'
import { Segmented } from '@/components/Segmented'
import { useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { AlertCircle, ExternalLink, Play } from 'lucide-react'
import { REPORT_KINDS, SKILL_LABEL, providerProfile, type AssessmentReport, type AssessmentSource, type CompanyAssessment, type GameId, type ReportKind, type TrainingMode } from '../../../../shared/assessments'
import type { Job } from '../../../../shared/types'
import { api, type Me } from '../../../lib/api'
import { useResource } from '../../../lib/hooks'
import posthog from '../../../lib/posthog'
import { GAMES } from '../games'
import { drillPlan, trainingPlan } from '../providers/plan'
import { skillProgress } from '../analytics/skills'
import { Sparkline } from './Sparkline'
import { MODE_HINT, MODE_LABEL, practiceHref } from './modes'
import { PROVIDER_GAMES, providerGames, type ProviderGame } from '../../../../shared/assessment-catalog'
import { testCountLine, type TestCount } from '../../../../shared/test-reports'
import { MockInterview } from '../../../components/MockInterview'
import { PrepGhost } from '../../../components/PrepGhost'
import { ErrorNote } from '../../../components/ErrorNote'
import '../assessments.css'

const SOURCE_ORDER: AssessmentSource['kind'][] = ['official', 'provider', 'university', 'candidate report', 'forum']
// 'test reported' is the one-tap "Which test?" answer, shown as counts (shared/test-reports.ts), not filed here.
type FiledKind = Exclude<ReportKind, 'test reported'>
const FILED = REPORT_KINDS.filter((k): k is FiledKind => k !== 'test reported')
const REPORTED: Record<FiledKind, string> = {
  'assessment changed': 'the assessment changed',
  'test no longer used': 'the test is no longer used',
  'new game encountered': 'a new game',
  'provider changed': 'the provider changed',
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export function AssessmentPrep({ job, me, onSpend }: { job: Job; me: Me; onSpend: () => Promise<void> }) {
  const res = useResource(() => api.jobAssessment(job.id), [job.id])
  const sessions = useResource(() => api.trainingSessions().then((r) => r.sessions), [])
  const bench = useResource(() => api.benchmarks().then((r) => r.benchmarks), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exhausted = me.budget.used >= me.budget.limit

  const research = async () => {
    setBusy(true)
    setError(null)
    try {
      const { assessment } = await api.researchAssessment(job.id)
      posthog.capture('assessment_researched', { found: Boolean(assessment), confidence: assessment?.confidence ?? null })
      res.setData((prev) => ({ tests: [], testsChanged: 0, askTest: false, ...prev, assessment, reports: prev?.reports ?? [] }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not research this process')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  if (res.loading && !res.data) return <PrepGhost title="Online test" lines={1} status="Looking up the assessment…" />
  if (res.error) return <ErrorNote text={res.error} />

  const assessment = res.data?.assessment ?? null
  const reports = res.data?.reports ?? []
  const tests = res.data?.tests ?? []
  const plan = trainingPlan(assessment)
  const drill = drillPlan(sessions.data ?? [], plan.allocation)
  const drillMin = Math.round(drill.reduce((t, d) => t + d.seconds, 0) / 60)
  const progress = skillProgress(sessions.data ?? [], plan.allocation.map((a) => a.skill), bench.data ?? [])

  return (
    <div className="prep">
      {error && <ErrorNote text={error} />}
      {assessment ? (
        <Detected assessment={assessment} reports={reports} tests={tests} testsChanged={res.data?.testsChanged ?? 0} jobId={job.id} />
      ) : (
        <section className="posting__block" aria-labelledby="prep-none">
          <h3 id="prep-none" className="label">
            Online test
          </h3>
          <p className="prep__lede">Find which test {job.company} uses, so you can practise for it.</p>
          <TestCounts tests={tests} />
          <button type="button" className="btn" onClick={() => void research()} disabled={busy || exhausted} aria-busy={busy}>
            {busy ? 'Looking…' : 'Find the test'}
          </button>
          {exhausted && !busy && <p className="prep__meta">Monthly budget used up. See <Link href="/profile">Profile</Link> for the reset date.</p>}
          {busy && <AiWorking steps={['Searching public sources', 'Working out which test they use']} expected={30} shape="lines" />}
        </section>
      )}

      {assessment?.assessmentTypes.includes('video interview') && (
        <section className="posting__block" aria-labelledby="prep-video">
          <h3 id="prep-video" className="label">
            Video interview rehearsal
          </h3>
          <MockInterview job={job} onSpend={onSpend} />
        </section>
      )}

      {assessment && !plan.hasGames && !assessment.assessmentTypes.includes('video interview') && (
        <section className="posting__block" aria-labelledby="prep-nogames">
          <h3 id="prep-nogames" className="label">
            No game-based assessment detected
          </h3>
          <p className="prep__lede">
            {assessment.assessmentTypes.length
              ? `The known stages are ${assessment.assessmentTypes.join(', ')}. None of them test a skill Agisse's drills train, so there is nothing to practise here.`
              : 'The sources do not name a test Agisse can help you practise for.'}
          </p>
        </section>
      )}

      {plan.hasGames && (
        <>
          <section className="posting__block" aria-labelledby="prep-skills">
            <div className="prep__head">
              <h3 id="prep-skills" className="label">
                Likely skills tested
              </h3>
              {plan.estimated && <span className="prep__tag">Estimated{plan.source === 'provider' ? ' from the provider' : ''}</span>}
            </div>
            <ul className="prep__alloc">
              {plan.allocation.map((a) => (
                <li key={a.skill}>
                  <span>{SKILL_LABEL[a.skill]}</span>
                  <span className="prep__bar" aria-hidden="true">
                    <span style={{ width: `${Math.round(a.weight * 100)}%` }} />
                  </span>
                  <span className="tnum">{Math.round(a.weight * 100)}%</span>
                </li>
              ))}
            </ul>
            <div className="posting__actions">
              <Link href={practiceHref(job.id, 'drill', drill.map((d) => d.gameId))} className="btn btn--primary">
                <Play aria-hidden="true" /> {MODE_LABEL.drill} · about {drillMin} min
              </Link>
              <Link href={practiceHref(job.id, 'simulation', plan.practiceOrder)} className="btn">
                {MODE_LABEL.simulation}
              </Link>
            </div>
            <p className="prep__meta">{MODE_HINT.simulation}</p>
          </section>

          <Drills jobId={job.id} order={plan.practiceOrder} />

          <section className="posting__block" aria-labelledby="prep-progress">
            <h3 id="prep-progress" className="label">
              Your progress
            </h3>
            <ul className="prep__progress">
              {progress.map((p) => (
                <li key={p.skill}>
                  <span>{SKILL_LABEL[p.skill]}</span>
                  {p.current === null ? (
                    <span className="prep__meta">Not trained yet</span>
                  ) : (
                    <>
                      <span className="prep__score tnum">{p.current}</span>
                      <span className="prep__trend">
                        <Sparkline points={p.trend} />
                        {p.trend.length > 1 && <span className="tnum">{p.trend.join(' → ')}</span>}
                        {p.percentile !== null && <span>Higher than {p.percentile}% of Agisse users</span>}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="booth__model">Agisse's own 0–100 scale, averaged over your last three sessions. Not an employer's score, and does not predict one.</p>
          </section>
        </>
      )}

      {assessment && <ReportForm jobId={job.id} onReported={(r) => res.setData((prev) => (prev ? { ...prev, reports: [r, ...prev.reports] } : prev))} />}
    </div>
  )
}

// A stage that names a provider without naming its games gets that provider's whole battery.
const PROVIDER_MENTION: [RegExp, string][] = [
  [/pymetrics/i, 'pymetrics'],
  [/arctic shores/i, 'arctic-shores'],
  [/smartpredict|\baon\b/i, 'aon'],
  [/cognify|criteria/i, 'criteria'],
  [/hirevue games/i, 'hirevue'],
  [/\bshl\b/i, 'shl'],
  [/cappfinity|\bcapp\b/i, 'cappfinity'],
  [/\bsova\b/i, 'sova'],
  [/saville|\bswift\b/i, 'saville'],
  [/talent ?q|korn ferry/i, 'talent-q'],
  [/watson[- ]glaser/i, 'watson-glaser'],
]
const named = (text: string, g: ProviderGame) => new RegExp(`\\b${g.name.replace(/[^a-z0-9 -]/gi, '')}\\b`, 'i').test(text)

/** The real games a stage description names (the named provider's first: "Numerical Reasoning" exists at several), or that provider's battery. */
export function stageGames(stage: string): ProviderGame[] {
  const provider = PROVIDER_MENTION.find(([re]) => re.test(stage))?.[1]
  const byName = PROVIDER_GAMES.filter((g) => named(stage, g))
  const own = byName.filter((g) => g.provider === provider)
  if (own.length) return own
  if (byName.length) return byName
  return provider ? providerGames(provider) : []
}

function Stages({ stages, jobId }: { stages: string[]; jobId: string }) {
  return (
    <ol className="prep__stages">
      {stages.map((stage) => {
        const games = stageGames(stage)
        return (
          <li key={stage}>
            <span>{stage.replace(/^\d+\.\s*/, '')}</span>
            {games.length > 0 && (
              <span className="prep__stage-games">
                {games.map((g) => (
                  <Link key={g.id} href={practiceHref(jobId, 'practice', [g.id])} className="chip" title={`${g.measures}${g.note ? `. ${g.note}` : ''}`}>
                    {g.name}
                  </Link>
                ))}
                <Link href={practiceHref(jobId, 'simulation', games.map((g) => g.id))} className="btn btn--sm">
                  {MODE_LABEL.simulation}
                </Link>
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** What students said they were sent, as counts; never who. */
function TestCounts({ tests }: { tests: TestCount[] }) {
  if (!tests.length) return null
  return (
    <ul className="prep__reported" aria-label="Tests students reported">
      {tests.map((t) => (
        <li key={t.provider}>{testCountLine(t)}</li>
      ))}
    </ul>
  )
}

function Detected({ assessment: a, reports, tests, testsChanged, jobId }: { assessment: CompanyAssessment; reports: AssessmentReport[]; tests: TestCount[]; testsChanged: number; jobId: string }) {
  const provider = providerProfile(a.provider)
  const since = reports.filter((r) => r.createdAt > a.sourceDate)
  // A reported test that contradicts this intel counts as "the provider changed"; the intel stays as sourced.
  const counts = FILED.map((k) => [k, since.filter((r) => r.kind === k).length + (k === 'provider changed' ? testsChanged : 0)] as const).filter(([, n]) => n > 0)
  const sources = [...a.sources].sort((x, y) => SOURCE_ORDER.indexOf(x.kind) - SOURCE_ORDER.indexOf(y.kind))
  return (
    <section className="posting__block" aria-labelledby="prep-detected">
      <div className="prep__head">
        <h3 id="prep-detected" className="label">
          Assessment detected
        </h3>
        <span className={`prep__tag prep__tag--${a.confidence}`}>{a.confidence[0]!.toUpperCase() + a.confidence.slice(1)} confidence</span>
      </div>
      <p className="prep__provider">
        {provider ? (
          <a href={provider.url} target="_blank" rel="noopener noreferrer">
            {provider.name} <ExternalLink aria-hidden="true" />
          </a>
        ) : (
          (a.provider ?? 'Provider not identified')
        )}
      </p>
      <dl className="dims">
        {a.assessmentTypes.length > 0 && <Row label="Tests" value={a.assessmentTypes.join(', ')} />}
        {a.timeLimits && <Row label="Time limits" value={a.timeLimits} />}
        {a.difficulty && <Row label="Difficulty" value={a.difficulty} />}
        <Row label="Last verified" value={monthYear(a.sourceDate)} />
      </dl>
      {a.stages.length > 0 && <Stages stages={a.stages} jobId={jobId} />}
      {a.notes && <p className="prep__meta">{a.notes}</p>}
      {provider && <p className="prep__meta">{provider.note}</p>}
      <TestCounts tests={tests} />
      {counts.map(([k, n]) => (
        <p key={k} className="notice" role="note">
          <AlertCircle aria-hidden="true" />
          <span>
            {n} {n === 1 ? 'person' : 'people'} reported {REPORTED[k]} since this was verified.
          </span>
        </p>
      ))}
      {sources.length > 0 && (
        <ul className="prep__sources" aria-label="Sources">
          {sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title} <ExternalLink aria-hidden="true" />
              </a>
              <span className="prep__meta"> {s.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
)

function Drills({ jobId, order }: { jobId: string; order: GameId[] }) {
  const [mode, setMode] = useState<TrainingMode>('practice')
  return (
    <section className="posting__block" aria-labelledby="prep-drills">
      <h3 id="prep-drills" className="label">
        Tests to practise, in order
      </h3>
      <Segmented label="Mode" value={mode} options={(['practice', 'simulation', 'drill'] as const).map((m) => [m, MODE_LABEL[m]])} onChange={setMode} />
      <p className="prep__meta">{MODE_HINT[mode]}</p>
      <ol className="prep__drills">
        {order.map((id) => (
          <li key={id}>
            <span>
              <span className="prep__drill-name">{GAMES[id]?.name ?? id}</span>
              {GAMES[id] && <span className="prep__meta"> {GAMES[id].howTo}</span>}
            </span>
            <Link href={practiceHref(jobId, mode, [id])} className="btn btn--sm" aria-label={`Start ${GAMES[id]?.name ?? id}, ${MODE_LABEL[mode]}`}>
              Start
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ReportForm({ jobId, onReported }: { jobId: string; onReported: (r: AssessmentReport) => void }) {
  const [kind, setKind] = useState<FiledKind>('assessment changed')
  const [detail, setDetail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | string>('idle')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('busy')
    try {
      const { report } = await api.reportAssessment({ jobId, kind, detail: detail.trim() || undefined })
      posthog.capture('assessment_reported', { kind })
      onReported(report)
      setDetail('')
      setState('sent')
    } catch (err) {
      setState(err instanceof Error ? err.message : 'Could not send the report')
    }
  }
  return (
    <form className="posting__block prep__report" onSubmit={submit} aria-labelledby="prep-report">
      <h3 id="prep-report" className="label">
        Report a change
      </h3>
      <div className="prep__report-row">
        <label className="field">
          <span className="field__label">What changed</span>
          <select className="field__input" value={kind} onChange={(e) => setKind(e.target.value as FiledKind)}>
            {FILED.map((k) => (
              <option key={k} value={k}>
                {k[0]!.toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Detail (optional)</span>
          <input className="field__input" value={detail} maxLength={500} onChange={(e) => setDetail(e.target.value)} placeholder="What you saw, and when" />
        </label>
      </div>
      <button type="submit" className="btn" disabled={state === 'busy'}>
        {state === 'busy' ? 'Sending…' : 'Send report'}
      </button>
      {state === 'sent' && (
        <p className="prep__meta" role="status">
          Thanks. Others preparing for this process will see it.
        </p>
      )}
      {!['idle', 'busy', 'sent'].includes(state) && <ErrorNote text={state} />}
    </form>
  )
}
