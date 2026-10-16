import { useState } from 'react'
import { PUBLISHERS, providerName } from '../../shared/assessment-catalog'
import { api } from '../lib/api'
import { useResource } from '../lib/hooks'
import { ErrorNote } from './ErrorNote'

const CHOICES = [...PUBLISHERS].sort((a, b) => providerName(a).localeCompare(providerName(b)))

/** Asked once when a job is at assessment: which publisher sent the test. Optional; a choice, "Not sure" or Skip ends it for this job. */
export function WhichTest({ jobId, company, counted }: { jobId: string; company: string; /** profile.shareOutcomes */ counted: boolean }) {
  const res = useResource(() => api.jobAssessment(jobId), [jobId])
  const [state, setState] = useState<'ask' | 'busy' | 'thanks' | 'gone'>('ask')
  const [error, setError] = useState<string | null>(null)
  if (!res.data?.askTest || state === 'gone') return null
  if (state === 'thanks')
    return (
      <p className="which-test prep__meta" role="status">
        {counted ? 'Thanks. Students see how many reported it, never who.' : 'Thanks. It stays out of the counts while Count my tracker anonymously is off.'}
      </p>
    )

  // null is "Not sure" or Skip: stored too, so the question doesn't come back.
  const send = async (detail: string | null) => {
    setState('busy')
    setError(null)
    try {
      await api.reportAssessment({ jobId, kind: 'test reported', detail })
      setState(detail ? 'thanks' : 'gone')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer')
      setState('ask')
    }
  }

  return (
    <div className="which-test">
      <label htmlFor={`which-test-${jobId}`}>Which test did {company} send?</label>
      <select id={`which-test-${jobId}`} className="field__input" defaultValue="" disabled={state === 'busy'} onChange={(e) => void send(e.target.value === 'unsure' ? null : e.target.value)}>
        <option value="" disabled>
          Choose the publisher
        </option>
        {CHOICES.map((p) => (
          <option key={p} value={p}>
            {providerName(p)}
          </option>
        ))}
        <option value="unsure">Not sure</option>
      </select>
      <button type="button" className="btn btn--sm btn--quiet" disabled={state === 'busy'} onClick={() => void send(null)}>
        Skip
      </button>
      {error && <ErrorNote text={error} />}
    </div>
  )
}
