import { AiWorking } from '@/components/AiWorking'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { AlertCircle, ArrowLeft, Download, ExternalLink, FileCode, FileUp, Printer, RefreshCw, X } from 'lucide-react'
import type { Job } from '../../shared/types'
import { api, type Me } from '../lib/api'
import { cvToLatex, withTemplate } from '../lib/latex'
import { useStored } from '../features/interviews/useStored'
import posthog from '../lib/posthog'
import { Rate } from '../components/Rate'
import { FreeModelNote } from '../components/FreeModelNote'

/** "Grade: magna cum laude" → bold label, as in the LaTeX template. */
const labelled = (s: string): ReactNode => {
  const m = /^([^:]{1,30}):\s+([\s\S]+)$/.exec(s)
  return m ? (
    <>
      <strong>{m[1]}:</strong> {m[2]}
    </>
  ) : (
    s
  )
}

function CvSection({ title, children }: { title: string; children: ReactNode[] | ReactNode }) {
  if (Array.isArray(children) ? !children.length : !children) return null
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function CvEntry({ head, location, title, dates, bullets }: { head: ReactNode; location?: string; title?: string; dates?: string; bullets: ReactNode[] }) {
  return (
    <div className="cv__item">
      <h3>
        <span>{head}</span>
        {location && <em>{location}</em>}
      </h3>
      {(title || dates) && (
        <p className="cv__line">
          <span>{title}</span>
          <span>{dates}</span>
        </p>
      )}
      {bullets.length > 0 && (
        <ul>
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The tailored CV as a plain one-column page; the browser's print dialog saves it as PDF. */
export function CvRoute({ me, refreshMe, jobId }: { me: Me; refreshMe: () => Promise<void>; jobId: string }) {
  const [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  const templateInput = useRef<HTMLInputElement>(null)

  const write = async (rewrite: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const { job } = await api.writeJobDoc(jobId, 'cv', rewrite)
      posthog.capture('cv_tailored', { is_rewrite: rewrite, score: job.score, gap_count: job.cv?.gaps.length ?? 0 })
      setJob(job)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not tailor the CV')
    } finally {
      setBusy(false)
      void refreshMe()
    }
  }

  // Load the posting; tailor on first open when there is no CV yet (StrictMode-safe: once).
  useEffect(() => {
    if (started.current) return
    started.current = true
    api
      .job(jobId)
      .then(({ job }) => {
        setJob(job)
        if (!job.cv) void write(false)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this posting'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const cv = job?.cv
  const exhausted = me.budget.used >= me.budget.limit
  const skillGroups = (cv?.skillGroups?.length ? cv.skillGroups : cv?.skills.length ? [{ label: 'Skills', items: cv.skills }] : []).filter((g) => g.items.length)
  // ponytail: the seeker's own .tex lives in this browser only; move to the profile row if people want it across devices.
  const [template, setTemplate] = useStored<{ name: string; tex: string } | null>('cv-template', null)
  const pickTemplate = async (file?: File) => {
    if (!file) return
    const tex = await file.text()
    if (!tex.includes('\\begin{document}')) return setError(`${file.name} has no \\begin{document}, so it can't be used as a template.`)
    setError(null)
    setTemplate({ name: file.name, tex })
    posthog.capture('cv_template_uploaded')
  }
  const latex = cv ? (template && withTemplate(cvToLatex(cv), template.tex)) || cvToLatex(cv) : ''
  const engine = /\\usepackage(\[[^\]]*\])?\{(fontspec|unicode-math)\}/.test(template?.tex ?? '') ? 'xelatex' : 'pdflatex'
  const texName = `cv-${(job?.company ?? 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.tex`
  const downloadTex = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([latex], { type: 'application/x-tex' }))
    a.download = texName
    a.click()
    URL.revokeObjectURL(a.href)
    posthog.capture('cv_latex', { via: 'download' })
  }
  return (
    <main className="map cv-page">
      <div className="cv-page__bar no-print">
        <Link href={`/jobs/${jobId}`} className="booth__back">
          <ArrowLeft aria-hidden="true" /> Back to {job ? job.company : 'the posting'}
        </Link>
        {cv && (
          <div className="posting__actions">
            <button type="button" className="btn btn--quiet" onClick={() => void write(true)} disabled={busy || exhausted}>
              <RefreshCw aria-hidden="true" /> {busy ? 'Rewriting…' : 'Rewrite'}
            </button>
            <details className="feed-menu posting__more">
              <summary className="btn btn--quiet">
                <FileCode aria-hidden="true" /> LaTeX
              </summary>
              <div className="feed-menu__panel" role="group" aria-label="LaTeX">
                <button type="button" className="btn btn--quiet" onClick={downloadTex} disabled={busy}>
                  <Download aria-hidden="true" /> Download .tex
                </button>
                {/* Overleaf's documented "open a snippet" POST; the CV only leaves the browser on this click. */}
                <form action="https://www.overleaf.com/docs" method="post" target="_blank" onSubmit={() => posthog.capture('cv_latex', { via: 'overleaf' })}>
                  <input type="hidden" name="snip" value={latex} />
                  <input type="hidden" name="snip_name" value={texName} />
                  <input type="hidden" name="engine" value={engine} />
                  <button type="submit" className="btn btn--quiet" disabled={busy}>
                    <ExternalLink aria-hidden="true" /> Open in Overleaf
                  </button>
                </form>
                {template ? (
                  <button type="button" className="btn btn--quiet" onClick={() => setTemplate(null)} title={`Using ${template.name}. Click to go back to the default layout.`}>
                    <X aria-hidden="true" /> {template.name}
                  </button>
                ) : (
                  <>
                    <input ref={templateInput} type="file" accept=".tex,application/x-tex,text/x-tex" hidden onChange={(e) => void pickTemplate(e.target.files?.[0])} />
                    <button type="button" className="btn btn--quiet" onClick={() => templateInput.current?.click()} title="Your own .tex: its look (preamble) is kept, the tailored CV fills the page.">
                      <FileUp aria-hidden="true" /> Your template
                    </button>
                  </>
                )}
              </div>
            </details>
            <button type="button" className="btn btn--primary" onClick={() => window.print()} disabled={busy}>
              <Printer aria-hidden="true" /> Save as PDF
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="notice notice--error no-print" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      {!job && !error && (
        <div className="no-print" aria-busy="true">
          <p className="sr-only" role="status">Loading the posting…</p>
          <article className="cv cv--ghost" aria-hidden="true">
            <span className="feed-ghost cv__ghost-name" />
            {[90, 75, 85, 60, 80, 70].map((w, i) => (
              <span key={i} className="feed-ghost feed-ghost--sm" style={{ width: `${w}%` }} />
            ))}
          </article>
        </div>
      )}
      {busy && (
        <div className="no-print">
          <AiWorking steps={['Reading the posting', 'Choosing what to lead with from your CV', cv ? 'Rewriting your CV for this posting' : 'Tailoring your CV to this posting']} shape={cv ? undefined : 'document'} />
        </div>
      )}

      {cv && (
        <>
          {cv.gaps.length > 0 && (
            <aside className="notice no-print">
              <AlertCircle aria-hidden="true" />
              <span>
                <strong>Left out on purpose:</strong> the posting asks for {cv.gaps.join('; ')}. Address them in the cover letter or the interview if you can back them.
              </span>
            </aside>
          )}
          {!!cv.changes?.length && (
            <section className="notice no-print" aria-label="What changed">
              <RefreshCw aria-hidden="true" />
              <div>
                <strong>What changed from your résumé:</strong>
                <ul>
                  {cv.changes.map((c, i) => (
                    <li key={i}>
                      {c.change} <span className="label--muted">({c.why})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <p className="label label--muted no-print">Reworded from your résumé only. Read every line before you send it.</p>
          <div className="no-print">
            <Rate key={cv.createdAt} task="agisse_cv" refId={jobId} />
            <FreeModelNote me={me} />
          </div>
          <article className="cv">
            <header>
              <h1 className="cv__name">{cv.name}</h1>
              {[cv.contact, cv.contactLine2 ?? []].map((line, i) => line.length > 0 && <p key={i} className="cv__contact">{line.join(' | ')}</p>)}
            </header>
            <CvSection title="Education">
              {cv.education.map((e, i) => (
                <CvEntry key={i} head={e.org} location={e.location} title={e.degree} dates={e.dates} bullets={(e.bullets ?? []).map(labelled)} />
              ))}
            </CvSection>
            <CvSection title="Professional Experience">
              {cv.experience.map((e, i) => (
                <CvEntry key={i} head={e.org} location={e.location} title={e.title} dates={e.dates} bullets={e.bullets} />
              ))}
            </CvSection>
            <CvSection title="Leadership & Extracurriculars">
              {(cv.leadership ?? []).map((e, i) => (
                <CvEntry key={i} head={e.org} location={e.location} title={e.title} dates={e.dates} bullets={e.bullets} />
              ))}
            </CvSection>
            <CvSection title={cv.projects.length > 1 ? 'Personal Projects' : 'Personal Project'}>
              {cv.projects.map((p, i) => (
                <CvEntry key={i} head={p.url ? <a href={/^https?:/i.test(p.url) ? p.url : `https://${p.url}`}>{p.name}</a> : p.name} title={p.title} dates={p.dates} bullets={p.bullets} />
              ))}
            </CvSection>
            <CvSection title="Skills & Interests">
              {skillGroups.length > 0 && (
                <ul>
                  {skillGroups.map((g, i) => (
                    <li key={i}>
                      <strong>{g.label}:</strong> {g.items.join(', ')}
                    </li>
                  ))}
                </ul>
              )}
            </CvSection>
          </article>
        </>
      )}
    </main>
  )
}
