import { useState } from 'react'
import { Link, useSearch } from 'wouter'
import { Segmented } from '@/components/Segmented'
import { Play } from 'lucide-react'
import { DRILL_IDS, SKILL_LABEL, type CognitiveSkill, type GameId } from '../../../../shared/assessments'
import { api } from '../../../lib/api'
import { useResource } from '../../../lib/hooks'
import { useProgress } from '../../../components/ProgressPanel'
import { GAMES } from '../games'
import { PracticeRunner } from './PracticeRunner'
import { MODE_HINT, MODE_LABEL, practiceHref } from './modes'
import { nextPractice, type KnownTests } from './next'
import { stageGames } from './AssessmentPrep'
import { providerProfile } from '../../../../shared/assessments'
import { CURATED_ASSESSMENTS, PROVIDER_GAMES, UNTRAINABLE, curatedFor, type ProviderGame } from '../../../../shared/assessment-catalog'
import '../assessments.css'

/** /practice: the menu when no mode is given, the runner otherwise. */
export function PracticeRoute() {
  return new URLSearchParams(useSearch()).has('mode') ? <PracticeRunner /> : <TrainingHub />
}

const FREE_MODES = ['practice', 'simulation'] as const
/** Publisher names as candidates see them in employer emails; the skill filter is the primary way in. */
const VENDOR: Record<string, string> = {
  shl: 'SHL',
  cappfinity: 'Cappfinity',
  sova: 'Sova',
  saville: 'Saville',
  'talent-q': 'Korn Ferry (Talent Q)',
  'watson-glaser': 'Watson-Glaser',
  criteria: 'Criteria (Cognify)',
  aon: 'Aon (cut-e)',
  pymetrics: 'pymetrics',
  hirevue: 'HireVue',
  'arctic-shores': 'Arctic Shores',
  'mckinsey-solve': 'McKinsey Solve',
}
const vendorName = (p: string) => VENDOR[p] ?? providerProfile(p)?.name ?? p

/** Skill filters: what a student knows they are weak at, not a publisher. */
const FILTERS = [
  ['all', 'All'],
  ['numerical', 'Numerical'],
  ['verbal', 'Verbal'],
  ['logical', 'Logical'],
  ['attention', 'Attention & memory'],
  ['behaviour', 'Personality & behaviour'],
  ['employer', 'By employer'],
] as const
type Filter = (typeof FILTERS)[number][0]
const SKILL_FILTER: Record<CognitiveSkill, Exclude<Filter, 'all' | 'employer'>> = {
  'numerical-speed': 'numerical',
  'numerical-accuracy': 'numerical',
  estimation: 'numerical',
  'verbal-reasoning': 'verbal',
  'logical-reasoning': 'logical',
  planning: 'logical',
  'working-memory': 'attention',
  'spatial-memory': 'attention',
  attention: 'attention',
  'reaction-time': 'attention',
  inhibition: 'attention',
  'cognitive-flexibility': 'attention',
  'visual-scanning': 'attention',
  'probabilistic-reasoning': 'behaviour',
  'emotion-recognition': 'behaviour',
  'situational-judgement': 'behaviour',
}
const PREVIEW = 8

type Item = { id: string; gameId: GameId; name: string; howTo: string; meta: string; vendor: string; filter: Filter; pg?: ProviderGame }
const realLength = (g: ProviderGame) =>
  g.timeRecorded ? `time recorded${g.realRounds ? `, ~${g.realRounds} items` : ''}` : g.realDuration ? `${Math.round(g.realDuration / 60)} min${g.realRounds ? `, ${g.realRounds} items` : ''}` : g.realRounds ? `${g.realRounds} rounds` : null
const filterOf = (id: GameId): Filter => SKILL_FILTER[GAMES[id].skills[0]!] ?? 'attention'
const fromCatalog = (g: ProviderGame): Item => ({
  id: g.id,
  gameId: g.gameId,
  name: g.name,
  howTo: g.howTo ?? GAMES[g.gameId]?.howTo ?? '',
  meta: [g.measures, realLength(g)].filter(Boolean).join(' · '),
  vendor: vendorName(g.provider),
  filter: filterOf(g.gameId),
  pg: g,
})
const ITEMS: Item[] = [
  ...DRILL_IDS.map((id) => ({ id, gameId: id, name: GAMES[id].name, howTo: GAMES[id].howTo, meta: GAMES[id].skills.map((s) => SKILL_LABEL[s]).join(' · '), vendor: 'Agisse', filter: filterOf(id) })),
  ...PROVIDER_GAMES.map(fromCatalog),
]

/** Companies whose curated stages name practisable tests: one click runs them all as one simulation. */
const mockOf = (c: { company: string; provider: string | null; stages: string[] }) => ({ company: c.company, provider: c.provider, games: [...new Set(c.stages.flatMap((s) => stageGames(s).map((g) => g.id)))] })
const MOCKS = CURATED_ASSESSMENTS.map(mockOf).filter((m) => m.games.length)
const minutesOf = (ids: string[]) => Math.max(5, Math.round(ids.reduce((t, id) => t + (PROVIDER_GAMES.find((g) => g.id === id)?.realDuration ?? 600), 0) / 60))

/** An employer's practisable tests, as the recommendation needs them. */
const testsFor = (company: string): KnownTests | null => {
  const m = curatedFor(company).map(mockOf).find((c) => c.games.length)
  return m ? { publisher: m.provider ? vendorName(m.provider) : null, games: m.games, minutes: minutesOf(m.games) } : null
}

/** The one practice to do next: from the seeker's own pipeline, else their weakest area (see next.ts). */
function NextUp() {
  const jobs = useResource(() => api.jobs().then((r) => r.jobs), [])
  const { progress, loading } = useProgress()
  // Wait for both so the card does not swap its advice once the jobs arrive.
  if (jobs.loading || loading) return <section className="practice__next" aria-busy="true" aria-label="Next practice" />
  const next = nextPractice(jobs.data ?? [], testsFor, progress?.steps[0] ?? null)
  return (
    <section className="practice__next" aria-labelledby="next-title">
      <h2 id="next-title" className="practice__next-title">
        {next.title}
      </h2>
      <p className="prep__lede">{next.detail}</p>
      <Link href={next.href} className="btn btn--primary">
        <Play aria-hidden="true" /> {next.action}
      </Link>
    </section>
  )
}

/** Free training, no posting needed: pick a mode and any tests. */
function TrainingHub() {
  const sessions = useResource(() => api.trainingSessions().then((r) => r.sessions), [])
  const [mode, setMode] = useState<(typeof FREE_MODES)[number]>('practice')
  const [filter, setFilter] = useState<Filter>('all')
  const [several, setSeveral] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const matching = ITEMS.filter((i) => filter === 'all' || i.filter === filter)
  const items = filter === 'all' && !expanded ? matching.slice(0, PREVIEW) : matching
  // Keep the menu's order whatever the click order.
  const toggle = (id: string) => setPicked((p) => ITEMS.map((i) => i.id).filter((g) => (g === id ? !p.includes(g) : p.includes(g))))
  // A drill's id is its GameId; a publisher's version is keyed by its own id.
  const last = (id: string, gameId: GameId) => sessions.data?.find((s) => s.gameId === gameId && s.providerGameId === (id === gameId ? null : id))?.result.score ?? null

  return (
    <main className="map practice">
      <NextUp />

      <details className="index-card__options">
        <summary>
          <span>All tests</span>
          <span className="index-card__options-hint">{ITEMS.length} tests, by skill or employer</span>
        </summary>
        <section className="posting__block" aria-labelledby="train-drills">
          <div className="prep__head">
            <h2 id="train-drills" className="sr-only">
              All tests
            </h2>
            <Link href={practiceHref(null, 'drill')} className="btn btn--sm">
              {MODE_LABEL.drill} · 7 min
            </Link>
            {filter !== 'employer' && (
              <button
                type="button"
                className="btn btn--sm"
                aria-pressed={several}
                onClick={() => {
                  setSeveral(!several)
                  setPicked([])
                }}
              >
                {several ? 'Done selecting' : 'Select several'}
              </button>
            )}
          </div>
          <div className="train__filters">
            <Segmented
              label="Skill"
              value={filter}
              options={FILTERS.map((f) => [f[0], f[1]])}
              onChange={(f) => {
                setFilter(f)
                setPicked([])
                setExpanded(false)
              }}
            />
          </div>
          {filter !== 'employer' && (
            <>
              <Segmented label="Mode" value={mode} options={FREE_MODES.map((m) => [m, MODE_LABEL[m]])} onChange={setMode} />
              <p className="prep__meta">{MODE_HINT[mode]}</p>
              <ul className={`train__list${several ? ' train__list--pick' : ''}`}>
                {items.map(({ id, gameId, name, howTo, meta, vendor, pg }) => {
                  const score = last(id, gameId)
                  return (
                    <li key={id}>
                      {several && <input type="checkbox" id={`train-${id}`} checked={picked.includes(id)} onChange={() => toggle(id)} aria-label={`Select ${name}`} />}
                      <div className="train__name">
                        <span className="prep__drill-name">{name}</span>
                        <span className="train__skills">{[vendor, meta].filter(Boolean).join(' · ')}</span>
                      </div>
                      <span className="train__last tnum" title="Your last score on Agisse's 0–100 practice scale">
                        {score !== null && (
                          <>
                            <span className="train__last-label">Last </span>
                            {score}
                          </>
                        )}
                      </span>
                      {several ? (
                        <span />
                      ) : (
                        <Link href={practiceHref(null, mode, [id])} className="btn btn--sm" aria-label={`Start ${name}, ${MODE_LABEL[mode]}`}>
                          Start
                        </Link>
                      )}
                      <details className="train__guide">
                        <summary>How it works</summary>
                        <p>{pg?.guide ?? howTo}</p>
                        {pg?.note && <p className="prep__meta">{pg.note}</p>}
                        {(pg?.basis || pg?.practiceUrl) && (
                          <p className="prep__meta">
                            {pg.basis === 'confirmed' ? 'Length and item count from the publisher.' : pg.basis === 'reconstructed' ? 'Length and item count reconstructed from candidate reports.' : ''}{' '}
                            {pg.practiceUrl && (
                              <a href={pg.practiceUrl} target="_blank" rel="noreferrer">
                                Official free practice
                              </a>
                            )}
                          </p>
                        )}
                      </details>
                    </li>
                  )
                })}
              </ul>
              {filter === 'all' && matching.length > PREVIEW && (
                <button type="button" className="btn btn--sm" onClick={() => setExpanded(!expanded)}>
                  {expanded ? 'Show fewer' : `Show all ${matching.length} tests`}
                </button>
              )}
              {picked.length > 0 && (
                <Link href={practiceHref(null, mode, picked)} className="btn btn--primary">
                  <Play aria-hidden="true" /> {MODE_LABEL[mode]}: {picked.length} {picked.length === 1 ? 'test' : 'tests'}
                </Link>
              )}
              <details className="train__guide">
                <summary>Tests you can't practise here</summary>
                {UNTRAINABLE.map((u) => (
                  <p key={u.name} className="prep__meta">
                    <span className="prep__drill-name">{u.name}</span> ({vendorName(u.provider)}) {u.note}
                  </p>
                ))}
              </details>
            </>
          )}
          {filter === 'employer' && (
            <>
              <p className="prep__meta">Every online test a company is known to use, back to back at real length ({MODE_LABEL.simulation}).</p>
              <ul className="train__mocks">
                {MOCKS.map((m) => (
                  <li key={m.company}>
                    <span className="prep__drill-name">{m.company}</span>
                    <span className="prep__meta tnum">
                      {m.games.length} {m.games.length === 1 ? 'test' : 'tests'} · about {minutesOf(m.games)} min
                    </span>
                    <Link href={practiceHref(null, 'simulation', m.games)} className="btn btn--sm" aria-label={`Start the ${m.company} tests`}>
                      Start
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </details>
    </main>
  )
}
