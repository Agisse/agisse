// "Your progress": one view over games, interview answers and CV reviews, with the three most useful next steps.
import { Link } from 'wouter'
import { COGNITIVE_SKILLS, SKILL_GAMES, SKILL_LABEL } from '../../shared/assessments'
import { answerStats, CV_CHECK_LABEL, nextSteps, persistentCvFails } from '../../shared/progress'
import { api } from '../lib/api'
import { useResource } from '../lib/hooks'
import { skillProgress } from '../features/assessments/analytics/skills'
import { Sparkline } from '../features/assessments/components/Sparkline'
import { practiceHref } from '../features/assessments/components/modes'
import '../features/assessments/assessments.css'

export function ProgressPanel() {
  const data = useResource(() => Promise.all([api.progress(), api.trainingSessions().then((r) => r.sessions), api.benchmarks().then((r) => r.benchmarks).catch(() => [])]), [])
  if (!data.data) return data.error ? <p className="prep__meta">Progress unavailable: {data.error}</p> : null
  const [{ answers, cvLog }, sessions, bench] = data.data

  const skills = skillProgress(sessions, [...COGNITIVE_SKILLS], bench).filter((s) => s.current !== null)
  const weakest = [...skills].sort((a, b) => a.current! - b.current!)[0]
  const a = answerStats(answers)
  const cv = [...cvLog].sort((x, y) => x.at.localeCompare(y.at))
  const stuck = persistentCvFails(cv)
  const lastJobId = [...answers].sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]?.jobId ?? null
  const steps = nextSteps({
    weakSkill: weakest ? { label: SKILL_LABEL[weakest.skill], value: weakest.current!, href: practiceHref(null, 'drill', [SKILL_GAMES[weakest.skill][0]!]) } : null,
    answers,
    cvLog: cv,
    lastJobId,
  })

  return (
    <section className="progress" aria-label="Your progress">
      {steps.length > 0 && (
        <ol className="progress__next" aria-label="Next steps">
          {steps.map((s) => (
            <li key={s.area}>
              <Link href={s.href}>{s.text}</Link>
            </li>
          ))}
        </ol>
      )}
      <div className="progress__cards">
        <div className="progress__card">
          <h3 className="label">Games</h3>
          {skills.length ? (
            <ul className="prep__progress">
              {skills.map((p) => (
                <li key={p.skill}>
                  <span>{SKILL_LABEL[p.skill]}</span>
                  <span className="prep__score tnum">{p.current}</span>
                  <span className="prep__trend">
                    <Sparkline points={p.trend} />
                    {p.percentile !== null && <span>Higher than {p.percentile}% of Agisse users</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="prep__meta">No games played yet.</p>
          )}
          {skills.length > 0 && <p className="prep__meta">Agisse's own 0–100 scale over your last three sessions; not an employer's score.</p>}
          <Link href="/prepare">Practise a test</Link>
        </div>

        <div className="progress__card">
          <h3 className="label">Interview answers</h3>
          {a.count ? (
            <>
              <p className="tnum">
                STAR coverage {a.star}% <Sparkline points={a.trend} />
              </p>
              <p className="prep__meta tnum">
                {a.count} answers{a.wpm !== null ? ` · ${a.wpm} words/min · ${a.fillersPerMin} fillers/min` : ''}
                {a.improved > 0 ? ` · ${a.improved} earlier gaps fixed` : ''}
              </p>
              {a.gaps.length > 0 && (
                <ul className="sel__tips" aria-label="Recurring gaps">
                  {a.gaps.slice(0, 3).map((g) => (
                    <li key={g.theme}>
                      {g.theme} <span className="prep__meta">({g.count}×)</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="prep__meta">No practice answers yet. Rehearse likely questions on a posting's Prepare tab.</p>
          )}
        </div>

        <div className="progress__card">
          <h3 className="label">CV</h3>
          {cv.length ? (
            <>
              <p className="tnum">
                Score {cv.at(-1)!.score}/100 <Sparkline points={cv.map((r) => r.score)} />
              </p>
              {cv.length > 1 && <p className="prep__meta tnum">{cv.map((r) => r.score).join(' → ')}</p>}
              {stuck.length > 0 && <p className="prep__meta">Still failing: {stuck.map((id) => CV_CHECK_LABEL[id] ?? id).join(', ')}.</p>}
            </>
          ) : (
            <p className="prep__meta">No CV review yet.</p>
          )}
          <Link href="/prepare/cv">Review my CV</Link>
        </div>
      </div>
    </section>
  )
}
