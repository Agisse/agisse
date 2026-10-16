// /prepare/interviews: one primary action (practise an interview), then quiet entries that open on demand.
// Everything here except answer feedback runs in the browser with no model call.
import { useState } from 'react'
import { Link, useSearch } from 'wouter'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { MockInterview } from '../../components/MockInterview'
import { StoryBank } from '../../components/StoryBank'
import { FIELDS, MODES, MODE_INFO, fieldFor, type FieldId, type Mode } from '../../../shared/interview-kit'
import { api } from '../../lib/api'
import { useResource } from '../../lib/hooks'
import { AssessmentCentreKit } from './AssessmentCentreKit'
import { Segmented } from './Segmented'
import { Technicals } from './Technicals'
import { useHashSection } from './useStored'
import './interviews.css'

const SECTIONS = [
  ['assessment-centre', 'Assessment centre', 'On the day, group exercise, in-tray, presentation'],
  ['technicals', 'Technicals', 'Finance and business flashcards'],
  ['stories', 'Your stories', 'STAR examples for eight competencies'],
] as const
type Section = (typeof SECTIONS)[number][0]

export function InterviewHub() {
  const params = new URLSearchParams(useSearch())
  const jobs = useResource(() => api.jobs().then((r) => r.jobs), [])
  const me = useResource(() => api.me(), [])
  const [mode, setMode] = useState<Mode>('one-way')
  // "job:<id>" or "field:<id>"; null until the seeker picks, so the default can follow their profile.
  const [picked, setPicked] = useState<string | null>(params.get('job') ? `job:${params.get('job')}` : null)
  const [running, setRunning] = useState(false)
  const [open, toggle] = useHashSection<Section>(SECTIONS.map(([id]) => id))

  const p = me.data?.profile
  const guess = fieldFor([...(p?.targetIndustries ?? []), p?.degree ?? '', p?.headline ?? ''].join(' '))
  // Default to the soonest interview the seeker is tracking, else questions for their field.
  const upcoming = (jobs.data ?? []).filter((j) => j.status === 'interview').sort((a, b) => (a.nextAt ?? '9').localeCompare(b.nextAt ?? '9'))[0]
  const source = picked ?? (upcoming ? `job:${upcoming.id}` : `field:${guess}`)
  const [kind, id] = source.split(':') as ['job' | 'field', string]
  const job = useResource(() => (kind === 'job' ? api.job(id).then((r) => r.job) : Promise.resolve(null)), [source])
  const field = kind === 'field' ? (id as FieldId) : fieldFor(`${job.data?.role ?? ''} ${p?.targetIndustries.join(' ') ?? ''}`)

  return (
    <main className="map interviews">
      <section id="mock" className="iv-start" aria-labelledby="iv-start-title">
        <h2 id="iv-start-title" className="iv-start__title">
          Practise an interview
        </h2>
        {running ? (
          <MockInterview key={`${source}-${mode}`} job={job.data} field={field} mode={mode} onExit={() => setRunning(false)} />
        ) : (
          <>
            <Segmented label="Interview type" options={MODES.map((m) => [m, MODE_INFO[m].label] as const)} value={mode as (typeof MODES)[number]} onChange={setMode} />
            <p className="prep__meta">{MODE_INFO[mode].hint}</p>
            <label className="field">
              <span className="label">Questions for</span>
              <select className="field__input" value={source} onChange={(e) => setPicked(e.target.value)}>
                {(jobs.data?.length ?? 0) > 0 && (
                  <optgroup label="Your applications">
                    {jobs.data!.map((j) => (
                      <option key={j.id} value={`job:${j.id}`}>
                        {j.company} · {j.role}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Any role in a field">
                  {Object.entries(FIELDS).map(([f, label]) => (
                    <option key={f} value={`field:${f}`}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button type="button" className="btn btn--primary iv-start-btn" disabled={kind === 'job' && !job.data} onClick={() => setRunning(true)}>
              Start interview
            </button>
          </>
        )}
      </section>

      <ul className="iv-more">
        <li id="case">
          <Link className="iv-more__row" href="/prepare/interviews/case">
            <span>
              <span className="iv-more__title">Consulting cases</span>
              <span className="iv-more__line">Full timed cases, a debrief per case, drills and where to practise</span>
            </span>
            <ChevronRight aria-hidden="true" className="iv-more__chev" />
          </Link>
        </li>
        <li>
          <Link className="iv-more__row" href="/prepare/interviews/banking">
            <span>
              <span className="iv-more__title">Investment banking</span>
              <span className="iv-more__line">Technicals by topic, a paper LBO, your pitch, networking calls</span>
            </span>
            <ChevronRight aria-hidden="true" className="iv-more__chev" />
          </Link>
        </li>
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
                {sid === 'assessment-centre' ? <AssessmentCentreKit /> : sid === 'technicals' ? <Technicals initial={field === 'consulting' ? 'business' : 'finance'} /> : <StoryBank />}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
