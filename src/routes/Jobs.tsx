import { AskAssistant } from '@/components/AskAssistant'
import { AiWorking } from '@/components/AiWorking'
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { AlertCircle, ArrowLeft, Check, Copy, Download, Dumbbell, ExternalLink, FileText, IdCard, MoreHorizontal, Plus, Search as SearchIcon, Trash2, X } from 'lucide-react'
import { EMPTY_PROFILE, JD_TEXT_LIMIT, JOB_STATUSES, NEXT_AT_LABEL, type ApplicationCheck, type CheckIssue, type Job, type JobStatus, type JobSummary, type Recommendation, type Requirement, type StatusChange } from '../../shared/types'
import { api, isAbort, type Me } from '../lib/api'
import { formatDate, groupByCompany, remembered, useAbortable, useCopy, useResource } from '../lib/hooks'
import { Field, TextField } from '../components/Field'
import { CompanyLogo, LogoCredit } from '../components/CompanyLogo'
import { BoardColumns } from './Board'
import { CompaniesView } from './Scout'
import { Segmented } from '../components/Segmented'
import posthog from '../lib/posthog'
import { SelectionProcess } from '../components/SelectionProcess'
import { OnlineTestLine } from '../components/OnlineTest'
import { PrepGhost } from '../components/PrepGhost'
import { OpenRoles, type OnSave } from '../components/OpenRoles'
import { VacancyFeed } from '../components/VacancyFeed'
import { isBlocked, type Listing } from '../../shared/listings'
import { PatternsPanel } from '../components/PatternsPanel'
import { Rate } from '../components/Rate'
import { FreeModelNote } from '../components/FreeModelNote'
import { JobWriting } from '../components/JobWriting'
import { trackerCsv } from '../lib/csv'

// The online-test prep pulls in every assessment game's definition; it loads with the Prepare tab.
const AssessmentPrep = lazy(() => import('../features/assessments/components/AssessmentPrep').then((m) => ({ default: m.AssessmentPrep })))

const VERDICT: Record<Recommendation, string> = { apply_now: 'Apply now', apply: 'Worth applying', do_not_apply: 'Long shot' }
/** The next steps on a posting, likeliest first: the status each moves to, and the button that says so. */
const NEXT: Partial<Record<JobStatus, [JobStatus, string][]>> = {
  saved: [['applied', 'I applied']],
  evaluated: [['applied', 'I applied']],
  applied: [['assessment', 'Got a test'], ['interview', 'Got an interview']],
  responded: [['assessment', 'Got a test'], ['interview', 'Got an interview']],
  assessment: [['interview', 'Got an interview']],
  interview: [['offer', 'Got an offer']],
}
/** The way out at each stage, kept quiet next to the next steps. */
const CLOSE: Partial<Record<JobStatus, [JobStatus, string]>> = {
  saved: ['discarded', 'Not for me'],
  evaluated: ['discarded', 'Not for me'],
  applied: ['rejected', 'Rejected'],
  responded: ['rejected', 'Rejected'],
  assessment: ['rejected', 'Rejected'],
  interview: ['rejected', 'Rejected'],
}
/** Statuses whose date the seeker should set as soon as they get there. */
// The Hired Wall's form on GitHub: nothing is pre-filled and nothing is sent until the seeker submits it there.
const HIRED_STORY = 'https://github.com/Agisse/agisse/issues/new?template=hired.yml'
const ASK_DATE = new Set<JobStatus>(['assessment', 'interview', 'offer'])
type View = 'feed' | 'track' | 'add' | 'offers' | 'companies'
const MATCH: Record<Requirement['match'], string> = { strong: 'Have it', partial: 'Partly', missing: 'Missing', na: 'n/a' }
const IMPORTANCE: Record<Requirement['importance'], string> = { critical: 'Critical', high: 'High', meaningful: 'Meaningful', preferred: 'Preferred', low_signal: 'Low' }
const SIGNAL = { positive: 'Good sign', neutral: 'Note', concerning: 'Watch' } as const
const LEGITIMACY = { high_confidence: 'Looks genuine', proceed_with_caution: 'Proceed with caution', suspicious: 'Suspicious' } as const
const STATUS_LABEL: Partial<Record<JobStatus, string>> = { assessment: 'Online assessment received' }
const statusName = (s: JobStatus) => s[0]!.toUpperCase() + s.slice(1)
/** Board filters: where the application stands. */
const BUCKETS = {
  all: ['All', () => true],
  saved: ['Saved', (s) => s === 'saved'],
  decide: ['To decide', (s) => s === 'evaluated'],
  active: ['In progress', (s) => s === 'applied' || s === 'responded' || s === 'assessment' || s === 'interview' || s === 'offer'],
  closed: ['Closed', (s) => s === 'rejected' || s === 'discarded'],
} satisfies Record<string, [string, (s: JobStatus) => boolean]>
type Bucket = keyof typeof BUCKETS
/** The board's filters as last set, so "Jobs" from a posting returns to the same view. */
let boardQuery = ''
/** Where the seeker was before they opened the current posting (Today, the feed, a company), so "Back" returns there; switching the posting's own tabs or opening its CV keeps it. A pasted link has none. */
let here = location.pathname + location.search
let cameFrom: string | null = null
const postingOf = (path: string) => /^\/jobs\/([^/?]+)/.exec(path)?.[1] ?? null
addEventListener('pushState', () => {
  const next = location.pathname + location.search
  const id = postingOf(next)
  if (id && id !== postingOf(here)) cameFrom = here
  here = next
})
for (const ev of ['replaceState', 'popstate']) addEventListener(ev, () => (here = location.pathname + location.search))
const DIMENSIONS = [
  ['cvMatch', 'Match with your CV'],
  ['northStar', 'Fits where you are heading'],
  ['comp', 'Pay'],
  ['culture', 'Culture and growth'],
  ['redFlags', 'Free of red flags'],
] as const

export type PostingTab = 'overview' | 'apply' | 'prepare' | 'offer'
type Props = { me: Me; refreshMe: () => Promise<void>; jobId?: string; tab?: PostingTab; /** /scout/:id: one company search, open under Companies. */ scoutId?: string }

export function JobsRoute({ me, refreshMe, jobId, tab = 'overview', scoutId }: Props) {
  const [, navigate] = useLocation()
  const list = useResource(() => api.jobs(), [])
  const [job, setJob] = useState<Job | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const search = useSearch()
  const q = new URLSearchParams(search)
  // "Open roles" from a Scout stop: ?careers=<name>&domain=<domain> opens the careers-page check for that company.
  const careers = q.get('careers') ? { name: q.get('careers')!, domain: q.get('domain') ?? '' } : null
  // ?view=feed|track|add; the old ?feed link, Scout's ?careers and the extension's ?import still land in the right view.
  // A waitlisted account opens on the feed: checking a posting waits for approval (evaluateInto).
  const asked = q.get('view')
  const picked: View = scoutId || (asked === 'companies' && !me.trial) ? 'companies' : asked === 'feed' || asked === 'track' || asked === 'add' || asked === 'offers' ? asked : q.has('feed') ? 'feed' : careers || q.has('import') ? 'add' : me.trial || me.profile?.skills?.length ? 'feed' : 'add'
  // Adding a job checks it, which opens once the account is approved.
  const view: View = me.trial && picked === 'add' ? 'feed' : picked
  const abort = useAbortable()
  const shown = jobId && job?.id === jobId ? job : null
  useEffect(() => {
    if (!jobId) boardQuery = search ? `?${search}` : ''
  }, [jobId, search])

  useEffect(() => {
    if (!jobId || job?.id === jobId) return
    let alive = true
    api
      .job(jobId)
      .then((r) => alive && setJob(r.job))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load this posting'))
    return () => {
      alive = false
    }
  }, [jobId, job?.id])

  const submit = async (input: { jdText: string; url: string; source: 'paste' | 'board' | 'city'; then?: 'cv' }) => {
    setError(null)
    setPending(Date.now())
    try {
      const { job, existing } = await api.createJob({ jdText: input.jdText, url: input.url || undefined }, abort.start())
      // Already on the board: the Worker returned the earlier evaluation without a new call.
      if (!existing) posthog.capture('job_evaluated', { score: job.score, recommendation: job.evaluation?.recommendation, has_url: Boolean(input.url), has_resume: list.data?.hasResume, source: input.source })
      setJob(job)
      navigate(input.then === 'cv' ? `/jobs/${job.id}/cv` : `/jobs/${job.id}`)
    } catch (e) {
      // Cancelled: the view stayed mounted underneath, so the posting is still pasted.
      if (!isAbort(e)) setError(e instanceof Error ? e.message : 'Could not read the posting')
    } finally {
      setPending(null)
      void Promise.all([list.reload(), refreshMe()])
    }
  }

  const onChange = (j: Job) => {
    setJob(j)
    list.setData((prev) => (prev ? { ...prev, jobs: prev.jobs.map((x) => (x.id === j.id ? { ...x, status: j.status, nextAt: j.nextAt, appliedAt: j.appliedAt, score: j.score, recommendation: j.evaluation?.recommendation ?? null } : x)) } : prev))
  }

  const remove = async (id: string) => {
    if (!confirm('Remove this posting?')) return
    await api.deleteJob(id)
    posthog.capture('job_deleted')
    setJob(null)
    navigate('/jobs')
    void list.reload()
  }

  // A listing from the feed, a careers page or a city search: a stored description goes straight to evaluation, otherwise the link is read.
  const evaluateRole = (listing: Listing, source: 'board' | 'city', opts?: { then?: 'cv' }) => {
    const jdText = source === 'board' && listing.text.trim().length >= 200 ? listing.text.trim().slice(0, JD_TEXT_LIMIT) : ''
    void submit({ jdText, url: listing.url, source, then: opts?.then })
  }

  // Free: the listing goes on the board as Saved, with its deadline; the row flips to "Saved to Jobs" on reload.
  const saveRole = async (listing: Listing, deadline: string | null) => {
    await api.saveJob({ url: listing.url, jdText: listing.text.trim().length >= 200 ? listing.text.trim().slice(0, JD_TEXT_LIMIT) : '', save: { company: listing.company, role: listing.title, location: listing.location || null, deadline } })
    posthog.capture('job_saved', { provider: listing.provider, has_deadline: Boolean(deadline) })
    await list.reload()
  }

  const jobs = list.data?.jobs ?? []
  const offers = jobs.filter((j) => j.status === 'offer')
  const exhausted = me.budget.used >= me.budget.limit || !!pending
  // List, Board or Map: the link's choice, else the one this user picked last.
  const pref = `track-layout.${me.user.id}`
  const askedLayout = TRACK_LAYOUTS.find((l) => l === q.get('layout'))
  const layout: TrackLayout = askedLayout ?? remembered(pref, TRACK_LAYOUTS, 'list')
  const withLayout = (next: TrackLayout) => {
    remembered(pref, TRACK_LAYOUTS, 'list', next)
    const p = new URLSearchParams(search)
    p.set('view', 'track')
    p.set('layout', next)
    navigate(`/jobs?${p}`, { replace: true })
  }

  return (
    <main className="map map--stack">
      <section aria-live="polite" aria-busy={!!pending || (!!jobId && !shown && !error)} hidden={!pending && !jobId}>
        {pending ? (
          <Evaluating startedAt={pending} onCancel={abort.cancel} />
        ) : shown ? (
          <Posting key={shown.id} job={shown} tab={tab} me={me} offers={offers.length} error={error} onChange={onChange} onSpend={refreshMe} onDelete={() => remove(shown.id)} />
        ) : error ? (
          <p className="notice notice--error" role="alert">
            <AlertCircle aria-hidden="true" /> <span>{error}</span>
          </p>
        ) : (
          jobId && <PostingGhost id={jobId} tab={tab} />
        )}
      </section>
      {/* Stays mounted while a posting is read, so a cancel comes back to the same filters or pasted text. */}
      {!jobId && (
        <div className="intake" style={pending ? { display: 'none' } : undefined}>
          <h1 className="display intake__title">Jobs</h1>
          <div className="jobs-nav">
            <nav className="posting-tabs" aria-label="Jobs">
              <Link href="/jobs?view=feed" aria-current={view === 'feed' ? 'page' : undefined}>For you</Link>
              <Link href="/jobs?view=track" aria-current={view === 'track' ? 'page' : undefined}>My jobs</Link>
              {!me.trial && <Link href="/jobs?view=companies" aria-current={view === 'companies' ? 'page' : undefined}>Companies</Link>}
            </nav>
            {!me.trial && (
              <Link href="/jobs?view=add" className="btn btn--sm btn--quiet" aria-current={view === 'add' ? 'page' : undefined}>
                <Plus aria-hidden="true" /> Add a job
              </Link>
            )}
          </div>
          {error && (
            <p className="notice notice--error" role="alert">
              <AlertCircle aria-hidden="true" /> <span>{error}</span>
            </p>
          )}
          {view === 'companies' ? (
            <CompaniesView me={me} refreshMe={refreshMe} scoutId={scoutId} />
          ) : view === 'offers' ? (
            <OfferCompare ids={offers.map((j) => j.id)} loading={!list.data} />
          ) : view === 'feed' ? (
            <VacancyFeed jobs={jobs} exhausted={exhausted} onEvaluate={evaluateRole} onSave={saveRole} profile={me.profile} onSavePrefs={(jobFeed) => api.saveProfile({ ...EMPTY_PROFILE, ...me.profile, jobFeed }).then(refreshMe)} onApplied={() => (void list.reload(), dispatchEvent(new Event('agisse:jobs')))} trial={!!me.trial} />
          ) : view === 'add' ? (
            <PostingForm me={me} jobs={jobs} busy={!!pending} hasResume={list.data?.hasResume ?? true} careers={careers} onSubmit={submit} onEvaluate={evaluateRole} onSave={saveRole} />
          ) : (
            <>
              {offers.length > 1 && (
                <p className="muted">
                  <Link href="/jobs?view=offers">Compare your {offers.length} offers</Link> side by side.
                </p>
              )}
              <Board jobs={list.data ? jobs : null} loading={list.loading} error={list.error} layout={layout} onLayout={withLayout} onJobs={(f) => list.setData((prev) => prev && { ...prev, jobs: f(prev.jobs) })} />
            </>
          )}
        </div>
      )}
    </main>
  )
}

/* ---------- Add a posting: paste it, or find it on a careers page or by city ---------- */

function PostingForm({ me, jobs, careers, busy, hasResume, onSubmit, onEvaluate, onSave }: { me: Me; jobs: JobSummary[]; careers: { name: string; domain: string } | null; busy: boolean; hasResume: boolean; onSubmit: (i: { jdText: string; url: string; source: 'paste' | 'board' | 'city' }) => void; onEvaluate: (listing: Listing, source: 'board' | 'city') => void; onSave: OnSave }) {
  const [mode, setMode] = useState<'paste' | 'board' | 'city'>(careers ? 'board' : 'paste')
  const [jdText, setJdText] = useState('')
  const [url, setUrl] = useState('')
  const [touched, setTouched] = useState(false)
  const [fromExt, setFromExt] = useState(false)
  // Jev's verdict for the text it was asked about; a stale one hides as soon as the text changes.
  const [quick, setQuick] = useState<{ text: string; label?: string; error?: string } | null>(null)
  const exhausted = me.budget.used >= me.budget.limit
  const text = jdText.trim()
  const quickCheck = async () => {
    setQuick({ text })
    try {
      const r = await api.quickFit(text)
      setQuick({ text, label: r.label })
      posthog.capture('job_quick_fit', { fit: r.fit })
    } catch (err) {
      setQuick({ text, error: err instanceof Error ? err.message : 'The quick look failed.' })
    }
  }
  const quickShown = quick?.text === text ? quick : null
  // With a link and no text, the Worker reads the posting from the link.
  const tooShort = text.length < 200 && !(text === '' && url.trim())
  const jdErr = touched && tooShort ? 'Paste the whole job description, or give its link.' : text.length > JD_TEXT_LIMIT ? 'That is too long. Paste the job description without the rest of the page.' : null

  // The browser extension hands over the page it was opened on (see extension/content-agisse.js) and it is evaluated straight away.
  // Too little text to evaluate: the form is prefilled and the user fixes it.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (e.source !== window || d?.source !== 'agisse-ext' || d.kind === 'contact' || typeof d.url !== 'string') return
      window.postMessage({ source: 'agisse-app', ack: true }, location.origin)
      const text = typeof d.text === 'string' ? d.text.slice(0, JD_TEXT_LIMIT).trim() : ''
      // The form holds the posting either way, so a cancelled evaluation comes back with it filled in.
      setUrl(d.url)
      setJdText(text)
      if (text.length >= 200 && !busy && !exhausted) return onSubmit({ jdText: text, url: d.url, source: 'paste' })
      setFromExt(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [busy, exhausted, onSubmit])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (tooShort || text.length > JD_TEXT_LIMIT || busy || exhausted) return
    onSubmit({ jdText: text, url: url.trim(), source: 'paste' })
  }

  return (
      <div className="index-card__form">
        <div id="posting-panel">
        {mode === 'paste' ? <form className="index-card__form jobs-add" onSubmit={submit} noValidate>
        <TextField id="jd" label="Job posting" hint="the full description, or leave empty and give the link" rows={10} value={jdText} onChange={(e) => setJdText(e.target.value)} error={jdErr} placeholder="Paste the role, responsibilities, requirements and pay as posted" />
        <Field id="url" label="Link to the posting" hint="enough on its own, unless it is LinkedIn" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
        {fromExt && (
          <p className="index-card__profile-nudge" role="status">
            <Check aria-hidden="true" />
            <span>Filled from the tab you sent. Check it, then check fit.</span>
          </p>
        )}
        {!hasResume && (
          <p className="index-card__profile-nudge">
            <IdCard aria-hidden="true" />
            <span>
              No résumé yet, so the score uses your profile fields only. <Link href="/profile">Import your résumé</Link> for a sharper score and a tailored CV.
            </span>
          </p>
        )}
        {quickShown && (quickShown.label || quickShown.error) && (
          <p className={quickShown.error ? 'notice notice--error' : 'index-card__profile-nudge'} role="status">
            {quickShown.error ?? <><strong>Quick look: {quickShown.label}.</strong> <span>Check fit for the requirement-by-requirement match.</span></>}
          </p>
        )}
        <div className="posting__actions">
          <button type="submit" className="btn btn--primary btn--sign" disabled={busy || exhausted}>
            {busy ? 'Reading the posting…' : 'Check fit'}
          </button>
          {text.length >= 200 && text.length <= JD_TEXT_LIMIT && (
            <button type="button" className="btn btn--quiet" onClick={() => void quickCheck()} disabled={busy || (!!quickShown && !quickShown.label && !quickShown.error)}>
              {quickShown && !quickShown.label && !quickShown.error ? 'Looking…' : 'Quick look (free)'}
            </button>
          )}
        </div>
        <p className="jobs-add__alt">
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setMode('board')}>Or check a company's careers page</button>
          {me.adzuna && <button type="button" className="btn btn--quiet btn--sm" onClick={() => setMode('city')}>Or search by city</button>}
        </p>
        </form> : <><button type="button" className="btn btn--quiet btn--sm" onClick={() => setMode('paste')}><ArrowLeft aria-hidden="true" /> Paste a posting instead</button><OpenRoles
          key={mode}
          mode={mode}
          initial={careers}
          jobs={jobs}
          exhausted={exhausted || busy}
          onEvaluate={onEvaluate}
          onSave={onSave}
          onPaste={() => setMode('paste')}
        /></>}
        </div>
      </div>
  )
}

function Evaluating({ startedAt, onCancel }: { startedAt: number; onCancel: () => void }) {
  return (
    <div className="booth">
      <AiWorking label="Reading the posting and checking it against your CV" startedAt={startedAt} onCancel={onCancel} />
    </div>
  )
}

/* ---------- One posting: the evaluation and what to do with it ---------- */

function PostingTabs({ id, tab }: { id: string; tab: PostingTab }) {
  return (
    <nav className="posting-tabs" aria-label="Application">
      <Link href={`/jobs/${id}`} aria-current={tab === 'overview' ? 'page' : undefined}>
        Overview
      </Link>
      <Link href={`/jobs/${id}/apply`} aria-current={tab === 'apply' ? 'page' : undefined}>
        Apply
      </Link>
      <Link href={`/jobs/${id}/prepare`} aria-current={tab === 'prepare' ? 'page' : undefined}>
        Prepare
      </Link>
      <Link href={`/jobs/${id}/offer`} aria-current={tab === 'offer' ? 'page' : undefined}>
        Offer
      </Link>
    </nav>
  )
}

/** The posting's frame while it loads: the real Back link and tabs, placeholders where the company and role go. */
function PostingGhost({ id, tab }: { id: string; tab: PostingTab }) {
  return (
    <div className="booth posting">
      <Link href={cameFrom ?? `/jobs${boardQuery}`} className="booth__back">
        <ArrowLeft aria-hidden="true" /> Back
      </Link>
      <header className="booth__head" aria-hidden="true">
        <div className="booth__sign">
          <span className="feed-ghost feed-ghost--logo booth__ghost-logo" />
          <div className="booth__ghost-text">
            <span className="feed-ghost booth__ghost-company" />
            <span className="feed-ghost booth__ghost-role" />
            <span className="feed-ghost feed-ghost--sm booth__ghost-meta" />
            <span className="feed-ghost feed-ghost--sm booth__ghost-meta" />
          </div>
        </div>
        <div className="booth__aside">
          <span className="feed-ghost booth__ghost-more" />
        </div>
      </header>
      <p className="sr-only" role="status">Loading the posting…</p>
      <PostingTabs id={id} tab={tab} />
    </div>
  )
}

function Posting({ job, tab, me, offers, error, onChange, onSpend, onDelete }: { job: Job; tab: PostingTab; me: Me; offers: number; error: string | null; onChange: (j: Job) => void; onSpend: () => Promise<void>; onDelete: () => void }) {
  const ev = job.evaluation
  const booths = useResource(() => api.searches().then((r) => r.searches), [])
  const booth = booths.data?.find((s) => s.company.toLowerCase() === job.company.toLowerCase())
  const [busy, setBusy] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const exhausted = me.budget.used >= me.budget.limit
  const dateRef = useRef<HTMLInputElement>(null)
  const [askDate, setAskDate] = useState(false)
  // "Did you apply?": set when the seeker leaves for the posting before applying, asked when they come back.
  const leftForPosting = useRef(false)
  const [askApplied, setAskApplied] = useState(false)
  // Asked once per browser: hidden for good after a click on the link or on ×.
  const [askStory, setAskStory] = useState(() => remembered('hired-story', ['ask', 'done'], 'ask') === 'ask')
  const storyDone = () => { remembered('hired-story', ['ask', 'done'], 'ask', 'done'); setAskStory(false) }
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !leftForPosting.current) return
      leftForPosting.current = false
      setAskApplied(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  // The More menu holds the status and date: it opens itself when a date is asked for, and closes on Esc or a click outside.
  const moreRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!askDate) return
    if (moreRef.current) moreRef.current.open = true
    dateRef.current?.focus()
  }, [askDate])
  useEffect(() => {
    const close = (e: Event) => {
      const d = moreRef.current
      if (!d?.open) return
      if (e instanceof KeyboardEvent ? e.key !== 'Escape' || e.defaultPrevented || !d.contains(document.activeElement) : d.contains(e.target as Node)) return
      d.open = false
      if (e instanceof KeyboardEvent) d.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])

  const setStatus = async (status: JobStatus) => {
    const { job: j } = await api.updateJob(job.id, { status })
    posthog.capture('job_status_changed', { status, previous_status: job.status, score: job.score })
    setAskApplied(false)
    setAskDate(ASK_DATE.has(status))
    onChange(j)
  }
  const setNextAt = async (nextAt: string | null) => {
    const { job: j } = await api.updateJob(job.id, { nextAt })
    setAskDate(false)
    onChange(j)
  }
  const followedUp = () => {
    posthog.capture('job_followed_up')
    void setNextAt(new Date(Date.now() + 7 * 86_400_000).toISOString())
  }
  const close = CLOSE[job.status]
  const nextStep = (
    <>
      {NEXT[job.status]?.map(([to, label], i) => (
        <button key={to} type="button" className={`btn btn--sm ${i === 0 && job.status !== 'saved' && job.status !== 'evaluated' ? 'btn--primary' : ''}`} onClick={() => void setStatus(to)}>
          {label}
        </button>
      ))}
      {job.status === 'applied' && !job.nextAt && (
        <button type="button" className="btn btn--sm btn--quiet" onClick={followedUp}>
          I followed up
        </button>
      )}
      {close && (
        <button type="button" className="btn btn--sm btn--quiet" onClick={() => void setStatus(close[0])}>
          {close[1]}
        </button>
      )}
    </>
  )
  // Long shot: name the gaps that matter most, critical first, and leave the call to the seeker.
  const gaps = (ev?.requirements ?? [])
    .filter((r) => r.match === 'missing' && (r.importance === 'critical' || r.importance === 'high'))
    .sort((a, b) => Number(b.importance === 'critical') - Number(a.importance === 'critical'))
    .slice(0, 2)

  const writeCover = async (rewrite: boolean) => {
    setBusy(true)
    setDocError(null)
    try {
      const { job: j } = await api.writeJobDoc(job.id, 'cover', rewrite)
      posthog.capture('cover_written', { is_rewrite: rewrite, score: job.score })
      onChange(j)
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'Could not write the cover letter')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  return (
    <div className="booth posting">
      <Link
        href={cameFrom ?? `/jobs${boardQuery}`}
        className="booth__back"
      >
        <ArrowLeft aria-hidden="true" /> Back
      </Link>
      <header className="booth__head">
        <div className="booth__sign">
          <CompanyLogo company={job.company} domain={job.domain ?? booth?.domain} size={56} />
          <div>
          <h2 className="display booth__company">{job.company}</h2>
          <p className="booth__role">
            {job.role}
            {job.location && <span> · {job.location}</span>}
            {ev?.role.seniority && <span> · {ev.role.seniority}</span>}
            {ev && ev.role.remote !== 'unknown' && <span> · {ev.role.remote === 'full' ? 'remote' : ev.role.remote}</span>}
          </p>
          <Timeline job={job} />
          {tab !== 'prepare' && <OnlineTestLine jobId={job.id} company={job.company} />}
          {job.url && (
            <a
              className="booth__domain"
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                leftForPosting.current = job.status === 'saved' || job.status === 'evaluated'
              }}
            >
              Open the posting <ExternalLink aria-hidden="true" />
            </a>
          )}
          </div>
        </div>
        <div className="booth__aside">
          {job.nextAt && NEXT_AT_LABEL[job.status] && <p className="muted tnum">{NEXT_AT_LABEL[job.status]} {formatDate(job.nextAt)}</p>}
          <details className="feed-menu posting__more" ref={moreRef}>
            <summary className="btn btn--sm btn--quiet" aria-label="More options for this posting">
              <MoreHorizontal aria-hidden="true" /> More
            </summary>
            <div className="feed-menu__panel" role="group" aria-label="More options">
              <label className="posting__status">
                <span className="label label--muted">Status</span>
                <select className="field__input" value={job.status} onChange={(e) => void setStatus(e.target.value as JobStatus)}>
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s] ?? statusName(s)}
                    </option>
                  ))}
                </select>
              </label>
              {NEXT_AT_LABEL[job.status] && <NextDate key={job.status} job={job} inputRef={dateRef} ask={askDate} onSave={(v) => void setNextAt(v)} />}
              <button type="button" className="btn btn--sm btn--quiet btn--danger" onClick={onDelete}>
                <Trash2 aria-hidden="true" /> Remove posting
              </button>
            </div>
          </details>
        </div>
      </header>

      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}

      {askApplied && (
        <p className="notice notice--ok" role="status">
          <span>Back from {job.company}. Did you apply?</span>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => { posthog.capture('job_apply_prompt', { answer: 'yes' }); void setStatus('applied') }}>
            Yes, I applied
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => { posthog.capture('job_apply_prompt', { answer: 'not_yet' }); setAskApplied(false) }}>
            Not yet
          </button>
        </p>
      )}

      <PostingTabs id={job.id} tab={tab} />

      {tab === 'prepare' ? (
        <>
          <SelectionProcess job={job} me={me} onSpend={onSpend} />
          <section id="online-test" aria-label="Online test">
            <Suspense fallback={<PrepGhost title="Online test" lines={1} status="Looking up the assessment…" />}>
              <AssessmentPrep job={job} me={me} onSpend={onSpend} />
            </Suspense>
          </section>
        </>
      ) : !ev && tab !== 'overview' ? (
        <EvaluateFirst job={job} exhausted={exhausted} onChange={onChange} onSpend={onSpend} />
      ) : tab === 'apply' ? (
        <>
          {job.status === 'applied' && !job.nextAt && (
            <p className="notice" role="note">
              <span>Sent a follow-up? Mark it, and Today asks again in a week if they stay silent.</span>
              <button type="button" className="btn btn--sm" onClick={followedUp}>
                I followed up
              </button>
            </p>
          )}
          <section className="posting__block" aria-labelledby="cv-title">
            <h3 id="cv-title" className="label">Tailored CV</h3>
            <p className="muted">Your CV reworded for this posting, never added to. Print it to PDF.</p>
            <div className="posting__actions">
              <Link href={`/jobs/${job.id}/cv`} className="btn btn--primary">
                <FileText aria-hidden="true" /> {job.cv ? 'Open tailored CV' : 'Tailor my CV'}
              </Link>
            </div>
            <KeywordLine job={job} />
          </section>
          <section className="posting__block" aria-label="Cover letter">
            <h3 className="label">Cover letter</h3>
            {docError && (
              <p className="notice notice--error" role="alert">
                <AlertCircle aria-hidden="true" /> <span>{docError}</span>
              </p>
            )}
            {job.coverLetter ? (
              // Keyed on the stored text so a rewrite replaces the draft being edited.
              <LetterField key={job.coverLetter} job={job} onChange={onChange}>
                <button type="button" className="btn btn--quiet" onClick={() => void writeCover(true)} disabled={busy || exhausted}>
                  {busy ? 'Rewriting…' : 'Rewrite'}
                </button>
              </LetterField>
            ) : (
              <div className="posting__actions">
                <button type="button" className="btn" onClick={() => void writeCover(false)} disabled={busy || exhausted} aria-busy={busy}>
                  <FileText aria-hidden="true" /> {busy ? 'Writing…' : 'Write a cover letter'}
                </button>
              </div>
            )}
            {busy && <AiWorking label={job.coverLetter ? 'Rewriting your cover letter' : 'Writing your cover letter'} />}
            {job.coverLetter && !busy && <Rate key={job.coverLetter} task="agisse_cover" refId={job.id} />}
            {job.coverLetter && !busy && <FreeModelNote me={me} />}
          </section>
          <JobWriting job={job} disabled={exhausted} onSpend={onSpend} />
          <CheckCard job={job} disabled={exhausted} onSpend={onSpend} />
        </>
      ) : tab === 'offer' ? (
        <>
          <PayCheckCard job={job} disabled={exhausted} onChange={onChange} onSpend={onSpend} />
          {job.status === 'offer' ? (
            <>
              <OfferTermsCard job={job} onChange={onChange} />
              <OfferBriefCard job={job} disabled={exhausted} onChange={onChange} onSpend={onSpend} />
              {offers > 1 && (
                <p className="muted">
                  <Link href="/jobs?view=offers">Compare your {offers} offers</Link> side by side.
                </p>
              )}
            </>
          ) : (
            <section className="posting__block" aria-labelledby="offer-title">
              <h3 id="offer-title" className="label">Negotiation brief</h3>
              <p className="muted">Opens when you set the status to Offer: a pay range from a cited source, your levers and a script to copy.</p>
            </section>
          )}
        </>
      ) : !ev ? (
        <>
          {job.closedAt && (job.status === 'saved' || job.status === 'evaluated') && (
            <p className="notice notice--error" role="note">
              <AlertCircle aria-hidden="true" /> <span>This posting looks closed: its job board stopped listing it on {formatDate(job.closedAt)}. Open the link to make sure.</span>
            </p>
          )}
          <EvaluateFirst job={job} exhausted={exhausted} onChange={onChange} onSpend={onSpend} />
          <div className="posting__actions">{nextStep}</div>
          {job.jdText.trim() && (
            <details className="posting__block posting__fold">
              <summary className="label">The posting</summary>
              <p className="posting__jd">{job.jdText}</p>
            </details>
          )}
          <NotesField job={job} onChange={onChange} />
        </>
      ) : (
      <>
      {job.status === 'assessment' && (
        <p className="notice notice--ok" role="note">
          <Dumbbell aria-hidden="true" />
          <span>
            Online assessment received. <Link href={`/jobs/${job.id}/prepare#online-test`}>Practise now</Link> on the skills it likely tests.
          </span>
          {nextStep}
        </p>
      )}

      {job.status === 'interview' && (
        <p className="notice notice--ok" role="note">
          <Dumbbell aria-hidden="true" />
          <span>
            Interview coming up. <Link href={`/jobs/${job.id}/prepare`}>Rehearse the likely questions</Link>.
          </span>
          {nextStep}
        </p>
      )}

      {job.status === 'offer' && (
        <p className="notice notice--ok" role="note">
          <Check aria-hidden="true" />
          <span>
            Offer received. <Link href={`/jobs/${job.id}/offer`}>Prepare your negotiation brief</Link>.
            {askStory && <> Got the job? <a href={HIRED_STORY} target="_blank" rel="noreferrer" onClick={storyDone}>Share your story</a>.</>}
          </span>
          {askStory && <button type="button" className="btn btn--quiet btn--sm notice__close" onClick={storyDone} aria-label="Hide Share your story"><X aria-hidden="true" /></button>}
        </p>
      )}

      <div className={`verdict verdict--${ev.recommendation}`}>
        <span className="verdict__score display tnum">
          {ev.score.toFixed(1)}
          <small>/5</small>
        </span>
        <div>
          <p className="verdict__label label">{VERDICT[ev.recommendation]}</p>
          <p className="verdict__tldr">{ev.role.tldr}</p>
          {ev.recommendation === 'do_not_apply' && (
            <p className="verdict__note">
              {gaps.length ? `Missing: ${gaps.map((r) => r.requirement).join(', ')}. Your call — apply if you can speak to these.` : 'Your call — apply if you have a reason to.'}
            </p>
          )}
          <Rate task="agisse_job_evaluation" refId={job.id} />
          <AskAssistant question="Should I apply to this job, and what would make my application stronger?">Should I apply?</AskAssistant>
          <a className="btn btn--sm btn--quiet verdict__how" href="/docs/methodology">How it’s scored</a>
          <FreeModelNote me={me} />
        </div>
      </div>

      {ev.hardStops.map((s) => (
        <p key={s} className="notice notice--error" role="note">
          <AlertCircle aria-hidden="true" /> <span>{s}</span>
        </p>
      ))}

      {job.closedAt && (job.status === 'saved' || job.status === 'evaluated') && (
        <p className="notice notice--error" role="note">
          <AlertCircle aria-hidden="true" /> <span>This posting looks closed: its job board stopped listing it on {formatDate(job.closedAt)}. Open the link to make sure.</span>
        </p>
      )}
      {isBlocked(job.company, { blocked: me.profile?.jobFeed?.blocked ?? [] }) && (
        <p className="notice" role="note">
          <AlertCircle aria-hidden="true" /> <span>You hid {job.company} in the job feed. Still worth applying?</span>
        </p>
      )}

      {/* The next step, on its own row above the work on it; the rest stays quiet. */}
      {job.status !== 'assessment' && job.status !== 'interview' && (NEXT[job.status] || CLOSE[job.status]) && (
        <div className="posting__actions" role="group" aria-label="Update the status">
          {job.status === 'evaluated' && (
            <Link href={`/jobs/${job.id}/apply`} className="btn btn--sm btn--primary">
              Prepare my application
            </Link>
          )}
          {nextStep}
        </div>
      )}
      <p className="posting__links">
        <Link href={booth ? `/s/${booth.id}` : `/contacts?${new URLSearchParams({ company: job.company, role: job.role, domain: job.domain ?? '' })}`}>
          {booth ? `People at ${job.company}` : `Find people at ${job.company}`}
        </Link>
        <Link href={`/jobs?${new URLSearchParams({ view: 'feed', similar: job.url ?? '', title: job.role })}`}>Similar roles</Link>
      </p>

      <section className="posting__block" aria-labelledby="req-title">
        <h3 id="req-title" className="label">
          Requirements against your CV
        </h3>
        <ol className="reqs">
          {ev.requirements.map((r, i) => (
            <li key={i} className={`req req--${r.match}`}>
              <span className="req__match label">{MATCH[r.match]}</span>
              {/* One line per requirement; the quote and the reasoning open on demand. A gap's advice stays out. */}
              <div>
                {r.jdQuote || r.cvEvidence ? (
                  <details className="req__fold">
                    <summary className="req__name">
                      {r.requirement} <span className="req__importance">{IMPORTANCE[r.importance]}{r.evidenceTier === 'inferred' ? ', estimated' : ''}</span>
                    </summary>
                    {r.jdQuote && <p className="req__quote">“{r.jdQuote}”</p>}
                    {r.cvEvidence && <p className="req__evidence">{r.cvEvidence}</p>}
                  </details>
                ) : (
                  <p className="req__name">
                    {r.requirement} <span className="req__importance">{IMPORTANCE[r.importance]}{r.evidenceTier === 'inferred' ? ', estimated' : ''}</span>
                  </p>
                )}
                {r.mitigation && <p className="req__mitigation">How to handle it: {r.mitigation}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* The detail behind the score, folded: the verdict and requirements above carry the decision. */}
      <details className="posting__block posting__fold">
        <summary className="label">Score detail · {LEGITIMACY[ev.legitimacy.tier]}</summary>
      <div className="posting__grid">
        <section className="posting__block" aria-labelledby="dim-title">
          <h3 id="dim-title" className="label">
            Score breakdown
          </h3>
          <dl className="dims">
            {DIMENSIONS.map(([k, label]) => (
              <div key={k}>
                <dt>{label}</dt>
                <dd className="tnum">{ev.dimensions[k]}/5</dd>
              </div>
            ))}
            <div>
              <dt>Pay as posted</dt>
              <dd>{ev.comp.advertisedVerbatim ?? 'not stated'}</dd>
            </div>
          </dl>
        </section>
        <section className="posting__block" aria-labelledby="legit-title">
          <h3 id="legit-title" className="label">
            Posting: {LEGITIMACY[ev.legitimacy.tier]}
          </h3>
          <ul className="reqs">
            {ev.legitimacy.signals.map((s, i) => (
              <li key={i} className={`req req--${s.weight}`}>
                <span className="req__match label">{SIGNAL[s.weight]}</span>
                <div>
                  <p className="req__name">{s.signal}</p>
                  <p className="req__evidence">{s.finding}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      </details>

      {ev.cvChanges.length > 0 && (
        <details className="posting__block posting__fold">
          <summary className="label">What to change in your CV · {ev.cvChanges.length}</summary>
          <ul className="posting__list">
            {ev.cvChanges.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </details>
      )}

      <NotesField job={job} onChange={onChange} />

      <p className="booth__model">Scored from the posting text and your CV only. Pay and legitimacy are read from the posting, not researched. Verify before you apply.</p>
      </>
      )}
    </div>
  )
}

/** `nextAt` as the value of a date input, in local time; interviews carry the time too. */
const toInput = (iso: string | null, withTime: boolean) => {
  if (!iso) return ''
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString()
  return withTime ? local.slice(0, 16) : local.slice(0, 10)
}

/** The one date that matters at this status (NEXT_AT_LABEL), saved as soon as it is picked. */
function NextDate({ job, inputRef, ask, onSave }: { job: Job; inputRef: Ref<HTMLInputElement>; ask: boolean; onSave: (iso: string | null) => void }) {
  const withTime = job.status === 'interview'
  const [value, setValue] = useState(toInput(job.nextAt, withTime))
  const save = () => {
    if (value === toInput(job.nextAt, withTime)) return
    // A bare date means midday local time, so it never slips a day across time zones.
    onSave(value ? new Date(withTime ? value : `${value}T12:00`).toISOString() : null)
  }
  return (
    <label className="posting__status">
      <span className="label label--muted">{NEXT_AT_LABEL[job.status]}</span>
      <input ref={inputRef} className="field__input tnum" type={withTime ? 'datetime-local' : 'date'} value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} />
      {ask && !value && <span className="field__hint">When is it?</span>}
    </label>
  )
}

/** A saved posting has no evaluation yet: one call scores it against the CV (the link is read first when there is no text). */
function EvaluateFirst({ job, exhausted, onChange, onSpend }: { job: Job; exhausted: boolean; onChange: (j: Job) => void; onSpend: () => Promise<void> }) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useAbortable()
  const run = async () => {
    setError(null)
    setStartedAt(Date.now())
    try {
      const { job: j } = await api.evaluateJob(job.id, abort.start())
      posthog.capture('job_evaluated', { score: j.score, recommendation: j.evaluation?.recommendation, has_url: Boolean(j.url), source: 'saved' })
      onChange(j)
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : 'Could not read the posting')
    } finally {
      setStartedAt(null)
      void onSpend()
    }
  }
  if (startedAt) return <AiWorking label="Reading the posting and checking it against your CV" startedAt={startedAt} onCancel={abort.cancel} />
  return (
    <section className="posting__block saved-posting" aria-labelledby="saved-title">
      <h3 id="saved-title" className="label">Saved, not checked yet</h3>
      <p>Scores it against your CV, requirement by requirement. The tailored CV, cover letter, answers and pay check work from it.</p>
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      <button type="button" className="btn btn--primary" disabled={exhausted} onClick={() => void run()}>
        Check fit
      </button>
      {exhausted && <p className="field__hint">This month's AI budget is used up.</p>}
    </section>
  )
}

/** The statuses the application went through; older postings without a history get one from their dates. */
function timeline(job: Job): StatusChange[] {
  if (job.history.length) return job.history
  const start: StatusChange = { status: job.score === null ? 'saved' : 'evaluated', at: job.createdAt }
  return job.appliedAt ? [start, { status: 'applied', at: job.appliedAt }] : [start]
}

function Timeline({ job }: { job: Job }) {
  return (
    <ol className="timeline" aria-label="Status history">
      {timeline(job).map((h, i) => (
        <li key={i} className="tnum">
          <span className="status-pill">{STATUS_LABEL[h.status] ?? statusName(h.status)}</span> {formatDate(h.at)}
        </li>
      ))}
    </ol>
  )
}

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `${currency} ${n.toLocaleString()}`
  }
}

/** What the company offered, typed by the seeker; saved on leaving each field, used by Compare offers. */
function OfferTermsCard({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  const known = job.offer ?? { base: null, currency: job.payCheck?.range?.currency ?? job.offerBrief?.range?.currency ?? 'EUR', extras: '' }
  const [base, setBase] = useState(known.base === null ? '' : String(known.base))
  const [currency, setCurrency] = useState(known.currency)
  const [extras, setExtras] = useState(known.extras)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    const next = { base: base.trim() ? Math.round(Number(base)) : null, currency: currency.trim().toUpperCase(), extras: extras.trim() }
    if (next.base !== null && !Number.isFinite(next.base)) return setError('Base pay is a number, e.g. 42000.')
    if (!/^[A-Z]{3}$/.test(next.currency)) return setError('Currency is a three-letter code, e.g. EUR.')
    setError(null)
    if (JSON.stringify(next) === JSON.stringify(job.offer)) return
    onChange((await api.updateJob(job.id, { offer: next })).job)
  }
  return (
    <section className="posting__block offer-terms" aria-labelledby="offer-terms-title">
      <h3 id="offer-terms-title" className="label">Your offer</h3>
      <div className="offer-terms__row">
        <Field id="offer-base" label="Base pay a year" className="field__input tnum" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value.replace(/[^\d]/g, ''))} onBlur={() => void save()} placeholder="42000" />
        <Field id="offer-currency" label="Currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} onBlur={() => void save()} />
      </div>
      <TextField id="offer-extras" label="What else comes with it" hint="bonus, equity, leave, start date, car, remote days" rows={2} value={extras} onChange={(e) => setExtras(e.target.value)} onBlur={() => void save()} />
      {error && <p className="field__error" role="alert">{error}</p>}
    </section>
  )
}

/** Every offer side by side: the terms the seeker typed, the market range found for it, and how it scored. */
function OfferCompare({ ids, loading }: { ids: string[]; loading: boolean }) {
  const offers = useResource(() => Promise.all(ids.map((id) => api.job(id).then((r) => r.job))), [ids.join()])
  if (loading || (ids.length && !offers.data)) return <p className="label label--muted">Loading offers…</p>
  if (offers.error) return <p className="notice notice--error" role="alert"><AlertCircle aria-hidden="true" /> <span>{offers.error}</span></p>
  const jobs = offers.data ?? []
  if (jobs.length < 2)
    return (
      <div className="empty-hall">
        <p className="empty-hall__text">{jobs.length ? 'One offer so far. A second one shows up here next to it.' : 'No offers yet.'} <Link href="/jobs?view=track">Back to My jobs</Link></p>
      </div>
    )
  const range = (j: Job) => j.offerBrief?.range ?? j.payCheck?.range ?? null
  // Marks the best value in a row; ties all get it, and a row with fewer than two values marks none.
  const best = (values: (number | null | undefined)[]) => {
    const known = values.filter((v): v is number => typeof v === 'number')
    const top = known.length > 1 ? Math.max(...known) : null
    return (v: number | null | undefined) => (top !== null && v === top ? 'is-best' : undefined)
  }
  const sameCurrency = new Set(jobs.map((j) => j.offer?.currency).filter(Boolean)).size <= 1
  const baseBest = best(sameCurrency ? jobs.map((j) => j.offer?.base) : [])
  const fitBest = best(jobs.map((j) => j.evaluation?.score))
  const northBest = best(jobs.map((j) => j.evaluation?.dimensions.northStar))
  const cultureBest = best(jobs.map((j) => j.evaluation?.dimensions.culture))
  const rows: [string, (j: Job) => ReactNode, ((j: Job) => string | undefined)?][] = [
    ['Base pay', (j) => (j.offer?.base != null ? money(j.offer.base, j.offer.currency) : <Link href={`/jobs/${j.id}/offer`}>Add it</Link>), (j) => baseBest(j.offer?.base)],
    ['Also offered', (j) => j.offer?.extras || <span className="muted">–</span>],
    ['Market range', (j) => {
      const r = range(j)
      if (!r) return <Link href={`/jobs/${j.id}/offer`}>Check pay</Link>
      const pos = j.offer?.base != null && j.offer.currency === r.currency ? (j.offer.base < r.low ? ', offer below it' : j.offer.base > r.high ? ', offer above it' : ', offer within it') : ''
      return <><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{money(r.low, r.currency)}–{money(r.high, r.currency)}</a>{pos}</>
    }],
    ['Fit with your CV', (j) => (j.evaluation ? `${j.evaluation.score.toFixed(1)}/5` : '–'), (j) => fitBest(j.evaluation?.score)],
    ['Where you are heading', (j) => (j.evaluation ? `${j.evaluation.dimensions.northStar}/5` : '–'), (j) => northBest(j.evaluation?.dimensions.northStar)],
    ['Culture and growth', (j) => (j.evaluation ? `${j.evaluation.dimensions.culture}/5` : '–'), (j) => cultureBest(j.evaluation?.dimensions.culture)],
    ['Where', (j) => [j.location, j.evaluation && j.evaluation.role.remote !== 'unknown' ? (j.evaluation.role.remote === 'full' ? 'remote' : j.evaluation.role.remote) : null].filter(Boolean).join(' · ') || '–'],
    ['Company health', (j) => (j.payCheck ? HEALTH[j.payCheck.health.verdict] : <Link href={`/jobs/${j.id}/offer`}>Check it</Link>)],
    ['Reply by', (j) => (j.nextAt ? formatDate(j.nextAt) : <Link href={`/jobs/${j.id}`}>Set the date</Link>)],
  ]
  return (
    <div className="offer-compare">
      <div className="offer-compare__scroll">
        <table>
          <caption className="sr-only">Your offers side by side</caption>
          <thead>
            <tr>
              <td />
              {jobs.map((j) => (
                <th key={j.id} scope="col">
                  <Link href={`/jobs/${j.id}`}>
                    <span className="booth-row__company">{j.company}</span>
                    <span className="booth-row__role">{j.role}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, cell, mark]) => (
              <tr key={label}>
                <th scope="row" className="label label--muted">{label}</th>
                {jobs.map((j) => (
                  <td key={j.id} className={`tnum ${mark?.(j) ?? ''}`}>{cell(j)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="booth__model">Best in each row is marked. Pay compares only when the offers share a currency. Ranges are quoted from one search result each; open the source before you lean on one.</p>
    </div>
  )
}

const HEALTH = { healthy: 'Looks healthy', mixed: 'Mixed signals', 'at-risk': 'At risk', unknown: 'No sourced news found' } as const
// Signal kind → the req--positive/neutral/concerning colours the legitimacy list uses.
const HEALTH_WEIGHT = { funding: 'positive', profit: 'positive', revenue: 'neutral', hiring: 'neutral', other: 'neutral', layoffs: 'concerning' } as const

function PayCheckCard({ job, disabled, onChange, onSpend }: { job: Job; disabled: boolean; onChange: (j: Job) => void; onSpend: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()
  const check = job.payCheck

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const { job: j } = await api.payCheck(job.id)
      posthog.capture('pay_check_run', { has_range: Boolean(j.payCheck?.range), verdict: j.payCheck?.health.verdict, is_refresh: Boolean(check) })
      onChange(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check pay and company health')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  return (
    <>
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      {check && (
        <>
          <section className="posting__block" aria-labelledby="pay-title">
            <h3 id="pay-title" className="label">
              Salary expectation
            </h3>
            {check.range ? (
              <p>
                <span className="tnum">
                  {check.range.currency} {check.range.low.toLocaleString()}–{check.range.high.toLocaleString()}
                </span>{' '}
                {check.range.basis}.{' '}
                <a href={check.range.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Source <ExternalLink aria-hidden="true" />
                </a>
              </p>
            ) : (
              <p>No sourced salary data found</p>
            )}
            {check.ask && (
              <>
                <p style={{ whiteSpace: 'pre-wrap' }}>{check.ask}</p>
                <div className="posting__actions">
                  <button type="button" className="btn" onClick={() => void copy(check.ask)}>
                    {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy answer'}
                  </button>
                </div>
              </>
            )}
          </section>
          <section className="posting__block" aria-labelledby="health-title">
            <h3 id="health-title" className="label">
              Company health: {HEALTH[check.health.verdict]}
            </h3>
            {check.health.signals.length > 0 && (
              <ul className="reqs">
                {check.health.signals.map((s, i) => (
                  <li key={i} className={`req req--${HEALTH_WEIGHT[s.kind]}`}>
                    <span className="req__match label">{s.kind}</span>
                    <div>
                      <p className="req__name">{s.text}</p>
                      <p className="req__evidence">
                        {s.date && <span className="tnum">{s.date} · </span>}
                        <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Source <ExternalLink aria-hidden="true" />
                        </a>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <section className="posting__block">
        <button type="button" className={check ? 'btn btn--quiet' : 'btn btn--ink'} onClick={() => void run()} disabled={busy || disabled} aria-busy={busy}>
          {busy ? 'Checking…' : check ? 'Refresh' : 'Check pay & company health'}
        </button>
        {busy && <AiWorking label="Searching pay ranges and company news" />}
        <p className="booth__model">
          {check ? `Checked ${formatDate(check.at)}. ` : ''}Ranges and news come only from linked search results. No link, no claim. Verify before you rely on it.
        </p>
      </section>
    </>
  )
}

function OfferBriefCard({ job, disabled, onChange, onSpend }: { job: Job; disabled: boolean; onChange: (j: Job) => void; onSpend: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()
  const brief = job.offerBrief

  const prepare = async () => {
    setBusy(true)
    setError(null)
    try {
      const { job: j } = await api.offerBrief(job.id)
      posthog.capture('offer_brief_prepared', { has_range: Boolean(j.offerBrief?.range), is_refresh: Boolean(brief) })
      onChange(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare the brief')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  return (
    <section className="posting__block" aria-labelledby="offer-title">
      <h3 id="offer-title" className="label">
        Negotiation brief
      </h3>
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      {brief && (
        <>
          {brief.range ? (
            <p>
              <span className="tnum">
                {brief.range.currency} {brief.range.low.toLocaleString()}–{brief.range.high.toLocaleString()}
              </span>{' '}
              {brief.range.basis}.{' '}
              <a href={brief.range.sourceUrl} target="_blank" rel="noopener noreferrer">
                Source <ExternalLink aria-hidden="true" />
              </a>
            </p>
          ) : (
            <p>No sourced salary data found</p>
          )}
          {brief.levers.length > 0 && (
            <dl className="dims">
              {brief.levers.map((l) => (
                <div key={l.lever}>
                  <dt>{l.lever}</dt>
                  <dd>{l.why}</dd>
                </div>
              ))}
            </dl>
          )}
          <p style={{ whiteSpace: 'pre-wrap' }}>{brief.script}</p>
          <div className="posting__actions">
            <button type="button" className="btn" onClick={() => void copy(brief.script)}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy script'}
            </button>
          </div>
          {brief.sources.length > 0 && (
            <ol className="posting__list">
              {brief.sources.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer">
                    {u} <ExternalLink aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      <button type="button" className={brief ? 'btn btn--quiet' : 'btn btn--ink'} onClick={() => void prepare()} disabled={busy || disabled} aria-busy={busy}>
        {busy ? 'Preparing…' : brief ? 'Refresh' : 'Prepare negotiation brief'}
      </button>
      {busy && <AiWorking label="Researching pay and preparing your brief" />}
    </section>
  )
}

const ISSUE: Record<CheckIssue['kind'], string> = { accuracy: 'Inaccurate', spelling: 'Spelling', grammar: 'Grammar', ats: 'ATS', wording: 'Wording' }
const SHOWN = { clearly: 'Shown', weakly: 'Weak', not: 'Missing' } as const
const SHOWN_CLASS = { clearly: 'strong', weakly: 'partial', not: 'missing' } as const
const CHECKED = { pasted: 'the résumé you pasted', tailored: 'your tailored CV', imported: 'your imported résumé', badge: 'your profile fields (no résumé imported)' } as const

/** The seeker's own résumé and letter against the posting and ATS screening. Kept in the page only: fix, then check again. */
function CheckCard({ job, disabled, onSpend }: { job: Job; disabled: boolean; onSpend: () => Promise<void> }) {
  const [resume, setResume] = useState('')
  const [cover, setCover] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [check, setCheck] = useState<ApplicationCheck | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const { check } = await api.checkApplication(job.id, { resume, cover })
      posthog.capture('application_checked', { resume_source: check.resumeSource, has_cover: check.hasCover, issues: check.issues.length })
      setCheck(check)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check the application')
    } finally {
      setBusy(false)
      void onSpend()
    }
  }

  const missing = check?.keywords.filter((k) => !k.resume) ?? []
  const issues = (doc: CheckIssue['doc']) => check?.issues.filter((i) => i.doc === doc) ?? []

  return (
    // The last step on Apply, before sending.
    <details id="check" className="posting__block posting__fold">
      <summary className="label">Check before you send</summary>
      <TextField id="check-resume" label="Your résumé" hint={job.cv ? 'the version you will send · empty checks your tailored CV' : 'the version you will send · empty checks your imported résumé'} rows={6} value={resume} onChange={(e) => setResume(e.target.value)} />
      <TextField id="check-cover" label="Your cover letter" hint={job.coverLetter ? 'the version you will send · empty checks the letter above' : 'optional'} rows={4} value={cover} onChange={(e) => setCover(e.target.value)} />
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      <div className="posting__actions">
        <button type="button" className={check ? 'btn btn--quiet' : 'btn btn--ink'} onClick={() => void run()} disabled={busy || disabled} aria-busy={busy}>
          <SearchIcon aria-hidden="true" /> {busy ? 'Checking…' : check ? 'Check again' : 'Check against the posting & ATS'}
        </button>
      </div>
      {busy && <AiWorking label="Checking every line against the posting and ATS" />}
      {check && (
        <div aria-live="polite">
          <p>{check.verdict}</p>
          <p className="booth__model">
            Checked {CHECKED[check.resumeSource]}
            {check.hasCover ? ' and your cover letter' : ', no cover letter'}.
          </p>

          {(['resume', 'cover'] as const).map((doc) =>
            doc === 'cover' && !check.hasCover ? null : (
              <div key={doc}>
                <h4 className="label label--muted">
                  {doc === 'resume' ? 'Résumé' : 'Cover letter'}: {issues(doc).length === 0 ? 'no mistakes found' : `${issues(doc).length} to fix`}
                </h4>
                {issues(doc).length > 0 && (
                  <ol className="reqs">
                    {issues(doc).map((i, n) => (
                      <li key={n} className={`req req--${i.kind === 'wording' || i.kind === 'ats' ? 'partial' : 'missing'}`}>
                        <span className="req__match label">{ISSUE[i.kind]}</span>
                        <div>
                          <p className="req__name">
                            <del>{i.quote}</del> → <ins>{i.fix}</ins>
                          </p>
                          <p className="req__evidence">{i.why}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ),
          )}

          <h4 className="label label--muted">Requirements in your documents</h4>
          <ol className="reqs">
            {check.requirements.map((r, i) => (
              <li key={i} className={`req req--${SHOWN_CLASS[r.shown]}`}>
                <span className="req__match label">{SHOWN[r.shown]}</span>
                <div>
                  <p className="req__name">
                    {r.requirement} <span className="req__importance">{IMPORTANCE[r.importance]}</span>
                  </p>
                  <p className="req__evidence">{r.where}</p>
                </div>
              </li>
            ))}
          </ol>

          <h4 className="label label--muted">
            ATS keywords in your résumé: {check.keywords.length - missing.length} of {check.keywords.length}
          </h4>
          {missing.length > 0 && <p>Not found word for word: {missing.map((k) => k.keyword).join(' · ')}</p>}
          <p className="booth__model">Keywords are matched exactly, as a simple ATS would. Add one only where your experience backs it. Every flagged line is quoted from your text; still read each fix before you accept it.</p>
        </div>
      )}
    </details>
  )
}

/** Exact match, free: how many of the posting's keywords the CV you would send has word for word, and the ones it lacks. */
function KeywordLine({ job }: { job: Job }) {
  const total = job.evaluation?.keywords.length ?? 0
  const missing = useResource(() => (total ? api.jobKeywords(job.id).then((r) => r.missingKeywords) : Promise.resolve([])), [job.id, job.cv, total])
  if (!total || !missing.data) return null
  const m = missing.data
  return (
    <div className="keyword-line">
      <p className="muted">
        <span className="tnum">{total - m.length} of {total}</span> posting keywords are in your {job.cv ? 'tailored ' : ''}CV{m.length ? '. Not found word for word:' : '.'}
      </p>
      {m.length > 0 && (
        <ul className="chips keyword-line__chips">
          {m.map((k) => (
            <li key={k} className="chip">{k}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LetterField({ job, onChange, children }: { job: Job; onChange: (j: Job) => void; children: ReactNode }) {
  const [letter, setLetter] = useState(job.coverLetter ?? '')
  const { copied, copy } = useCopy()
  const save = async () => {
    if (letter === (job.coverLetter ?? '')) return
    onChange((await api.updateJob(job.id, { coverLetter: letter })).job)
  }
  return (
    <>
      <TextField id="cover" label="Cover letter" hint="edit freely · saved when you leave the field" rows={16} value={letter} onChange={(e) => setLetter(e.target.value)} onBlur={() => void save()} />
      <div className="posting__actions">
        <button type="button" className="btn" onClick={() => void copy(letter)}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy letter'}
        </button>
        {children}
      </div>
    </>
  )
}

function NotesField({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  const [notes, setNotes] = useState(job.notes ?? '')
  const save = async () => {
    if (notes === (job.notes ?? '')) return
    onChange((await api.updateJob(job.id, { notes: notes || null })).job)
  }
  return <TextField id="job-notes" label="Notes" hint="contacts, rounds, how it went" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => void save()} />
}

/* ---------- The board: every pinned posting ---------- */

const TRACK_LAYOUTS = ['list', 'board', 'map'] as const
type TrackLayout = (typeof TRACK_LAYOUTS)[number]
// MapLibre is ~1 MB; only the Map layout pays for it.
const WorldMap = lazy(() => import('./WorldMap').then((m) => ({ default: m.WorldMap })))

/** The tracker as a .csv download, built here from the loaded list. */
function exportCsv(jobs: JobSummary[]) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([trackerCsv(jobs)], { type: 'text/csv;charset=utf-8' }))
  a.download = `agisse-applications-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 0)
  posthog.capture('tracker_exported', { jobs: jobs.length })
}

function Board({ jobs, loading, error, layout, onLayout, onJobs }: { jobs: JobSummary[] | null; loading: boolean; error: string | null; layout: TrackLayout; onLayout: (l: TrackLayout) => void; onJobs: (update: (jobs: JobSummary[]) => JobSummary[]) => void }) {
  const [, navigate] = useLocation()
  const search = useSearch()
  const params = new URLSearchParams(search)
  const bucket: Bucket = (params.get('status') ?? '') in BUCKETS ? (params.get('status') as Bucket) : 'all'
  const q = params.get('q') ?? ''
  const sort = params.get('sort') === 'score' ? 'score' : params.get('sort') === 'next' ? 'next' : 'newest'
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(search)
    next.set('view', 'track')
    if (value) next.set(key, value)
    else next.delete(key)
    navigate(`/jobs${next.size ? `?${next}` : ''}`, { replace: true })
  }

  const all = jobs ?? []
  const needle = q.trim().toLowerCase()
  const matching = all.filter((j) => BUCKETS[bucket][1](j.status) && (!needle || `${j.company} ${j.role} ${j.location ?? ''}`.toLowerCase().includes(needle)))
  if (sort === 'score') matching.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  // Dated first, soonest first; undated keep their order after them.
  if (sort === 'next') matching.sort((a, b) => (a.nextAt ? Date.parse(a.nextAt) : Infinity) - (b.nextAt ? Date.parse(b.nextAt) : Infinity))
  const groups = groupByCompany(matching)
  const tools = layout === 'list' && (all.length > 3 || bucket !== 'all' || !!q)

  return (
    <div>
      <div className="section-head track-head">
        {all.length > 0 && <Segmented label="Show postings as" value={layout} options={[['list', 'List'], ['board', 'Board'], ['map', 'Map']]} onChange={onLayout} />}
      </div>
      {tools && (
        <div className="board-tools">
          <div className="admin-page__filters board-tools__filters" role="group" aria-label="Filter by status">
            {(Object.keys(BUCKETS) as Bucket[]).map((b) => (
              <button key={b} type="button" className="admin-page__filter" aria-pressed={bucket === b} onClick={() => set('status', b === 'all' ? '' : b)}>
                {BUCKETS[b][0]} <span>{all.filter((j) => BUCKETS[b][1](j.status)).length}</span>
              </button>
            ))}
          </div>
          <label className="board-tools__search">
            <SearchIcon aria-hidden="true" />
            <span className="sr-only">Search postings</span>
            <input className="field__input" type="search" placeholder="Company or role" value={q} onChange={(e) => set('q', e.target.value)} />
          </label>
          <label className="board-tools__sort">
            <span className="sr-only">Sort</span>
            <select className="field__input" value={sort} onChange={(e) => set('sort', e.target.value === 'newest' ? '' : e.target.value)}>
              <option value="newest">Newest</option>
              <option value="score">Best score</option>
              <option value="next">Next date</option>
            </select>
          </label>
        </div>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      {jobs && layout === 'list' && <PatternsPanel jobs={jobs} />}
      {loading && !jobs ? (
        <p className="label label--muted">Loading jobs…</p>
      ) : layout === 'board' && all.length > 0 ? (
        <TrackBoard jobs={all} onJobs={onJobs} />
      ) : layout === 'map' && all.length > 0 ? (
        <Suspense fallback={<div className="world-map__frame" aria-busy="true" />}>
          <WorldMap jobs={all} />
        </Suspense>
      ) : groups.length > 0 ? (
        <ol className="booth-index">
          {groups.map((g) =>
            g.length === 1 ? (
              <li key={g[0]!.id}>
                <JobRow job={g[0]!} />
              </li>
            ) : (
              <li key={g[0]!.id} className="company-group">
                <div className="company-group__head">
                  <CompanyLogo company={g[0]!.company} domain={g.find((j) => j.domain)?.domain} />
                  <span className="booth-row__company">{g[0]!.company}</span>
                  <span className="label label--muted tnum">{g.length} roles</span>
                </div>
                <ol className="booth-index">
                  {g.map((j) => (
                    <li key={j.id}>
                      <JobRow job={j} nested />
                    </li>
                  ))}
                </ol>
              </li>
            ),
          )}
        </ol>
      ) : all.length > 0 ? (
        <div className="empty-hall">
          <p className="empty-hall__text">No postings match. <Link href="/jobs?view=track">Show all</Link></p>
        </div>
      ) : (
        <div className="empty-hall">
          <p className="empty-hall__text">No postings yet. <Link href="/jobs?view=feed">Pick one from For you</Link> or <Link href="/jobs?view=add">add a posting</Link>.</p>
        </div>
      )}
      {all.length > 0 && layout === 'list' && (
        <>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => exportCsv(all)}>
            <Download aria-hidden="true" /> Export CSV
          </button>
          <LogoCredit />
        </>
      )}
      {jobs?.length === 0 && (
        <aside className="how" aria-label="How an evaluation works">
          <h3 className="label label--muted how__title">How an evaluation works</h3>
          <ol>
            <li>A model lists what the posting asks for and how much each point matters, before it looks at your CV.</li>
            <li>It then checks each requirement against your CV, scores the fit from 1 to 5, and flags signs the posting may be stale or thin. Below 4.0 it calls it a long shot and names the gaps.</li>
            <li>For postings worth it, Agisse tailors your CV (rewording what is there, never adding what is not) and drafts a cover letter. People finds someone there to talk to first.</li>
          </ol>
        </aside>
      )}
    </div>
  )
}

function TrackBoard({ jobs, onJobs }: { jobs: JobSummary[]; onJobs: (update: (jobs: JobSummary[]) => JobSummary[]) => void }) {
  const people = useResource(() => api.contacted().then((r) => r.people), [])
  return <BoardColumns jobs={jobs} people={people.data ?? []} onJobs={onJobs} />
}

function JobRow({ job: j, nested }: { job: JobSummary; nested?: boolean }) {
  return (
    <Link href={`/jobs/${j.id}`} className={`booth-row job-row${nested ? ' job-row--nested' : ''}`}>
      {nested ? <span aria-hidden="true" /> : <CompanyLogo company={j.company} domain={j.domain} />}
      <span className="booth-row__details">
        <span className="booth-row__heading">
          {nested && <span className="sr-only">{j.company}, </span>}
          <span className="booth-row__company">{nested ? j.role : j.company}</span>
        </span>
        <span className="booth-row__role">{nested ? j.location : `${j.role}${j.location ? ` · ${j.location}` : ''}`}</span>
      </span>
      {j.score === null ? (
        <span className="booth-row__num tnum muted"><span aria-hidden="true">–</span><span className="sr-only">Not checked</span></span>
      ) : (
        <span className={`booth-row__num tnum job-score--${j.recommendation}`}>
          {j.score.toFixed(1)}<span className="sr-only"> of 5</span>
        </span>
      )}
      <span className="booth-row__meta">
        <span className={`status-pill status-pill--${j.status}`}>{statusName(j.status)}</span>
        {j.closedAt && (j.status === 'saved' || j.status === 'evaluated') && <span className="status-pill status-pill--rejected" title="Its public job board no longer lists it">Closed</span>}
        <span className="tnum">{j.nextAt && NEXT_AT_LABEL[j.status] ? `${NEXT_AT_LABEL[j.status]} ${formatDate(j.nextAt)}` : formatDate(j.createdAt)}</span>
      </span>
    </Link>
  )
}
