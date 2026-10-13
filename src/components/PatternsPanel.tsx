import { MIN_APPLIED, patterns, pct, type Rate } from '../../shared/patterns'
import type { JobSummary } from '../../shared/types'

/** Jobs › Tracking: reply and interview rates from the seeker's own applications. Hidden until there are enough of them. */
export function PatternsPanel({ jobs }: { jobs: JobSummary[] }) {
  const p = patterns(jobs)
  if (p.applied < MIN_APPLIED) return null
  return (
    <details className="index-card__options patterns">
      <summary>
        <span>Patterns in your applications</span>
        <span className="index-card__options-hint tnum">
          {p.applied} applied{p.medianReplyDays != null ? ` · replies take ${p.medianReplyDays} ${p.medianReplyDays === 1 ? 'day' : 'days'}` : ''}
        </span>
      </summary>
      <div className="index-card__options-fields">
        {p.lowScoreGap && <p>{p.lowScoreGap}</p>}
        <RateTable caption="By Agisse score" rows={p.byScore} />
        <RateTable caption="By where you applied" rows={p.bySource} />
        <p className="field__hint">A rejection counts as a reply. Small numbers swing a lot; read them as hints.</p>
      </div>
    </details>
  )
}

function RateTable({ caption, rows }: { caption: string; rows: Rate[] }) {
  return (
    <div className="patterns__scroll">
      <table className="patterns__table">
        <caption className="label label--muted">{caption}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Group</span></th>
            <th scope="col">Applied</th>
            <th scope="col">Replied</th>
            <th scope="col">Interview</th>
            <th scope="col">Offer</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.key}</th>
              <td>{r.applied}</td>
              <td>{pct(r.replied, r.applied)}%</td>
              <td>{pct(r.interviews, r.applied)}%</td>
              <td>{r.offers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
