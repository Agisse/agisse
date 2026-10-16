import { Link } from 'wouter'
import { ExternalLink, Play } from 'lucide-react'
import { OFFICIAL_PRACTICE, curatedFor, providerName, slug, testsFor } from '../../shared/assessment-catalog'
import { practiceHref } from '../features/assessments/components/modes'

/** Which online test a catalogue employer uses, as one quiet line; the stages and practice links open on tap. Nothing when unknown. */
export function OnlineTestLine({ jobId, company }: { jobId: string; company: string }) {
  const c = curatedFor(company)[0]
  if (!c) return null
  const tests = testsFor(c)
  const providers = [...new Set(tests.length ? tests.map((t) => t.provider) : [c.provider ?? ''])]
  const official = providers.filter((p) => OFFICIAL_PRACTICE[p])
  // Nothing to practise and no official sample: the Prepare tab covers the rest.
  if (!tests.length && !official.length) return null
  const what = tests.length > 3 ? `${tests.length} games` : (tests.length ? tests.map((t) => t.measures.replace(/ reasoning$/i, '')) : c.assessmentTypes.filter((t) => t !== 'video interview')).join(', ').toLowerCase()

  return (
    <details className="test-line">
      <summary>
        Online test: {providers.map(providerName).join(', ')}{what && ` (${what})`} · <span className="test-line__cue">Practise</span>
      </summary>
      <div className="test-line__body">
        <ol aria-label={`${c.company} selection process`}>
          {c.stages.map((s) => (
            <li key={s}>{s.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ol>
        <p className="test-line__links">
          {tests.length > 0 && (
            <Link href={practiceHref(jobId, 'simulation', tests.map((t) => t.id))} className="btn btn--sm btn--primary">
              <Play aria-hidden="true" /> Practise {tests.length > 1 ? `the ${tests.length} tests` : tests[0]!.name}
            </Link>
          )}
          {official.map((p) => (
            <a key={p} href={OFFICIAL_PRACTICE[p]} target="_blank" rel="noopener noreferrer">
              {providerName(p)}’s free samples <ExternalLink aria-hidden="true" />
            </a>
          ))}
          <a href={`/docs/guides/${slug(c.company)}`}>What each test measures</a>
        </p>
        <p className="prep__meta">From candidate reports, checked {new Date(c.sourceDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}. Your invitation email is the final word.</p>
      </div>
    </details>
  )
}
