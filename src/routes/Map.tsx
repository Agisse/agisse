import { AiWorking } from '@/components/AiWorking'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Redirect, useLocation, useSearch } from 'wouter'
import { AlertCircle, ArrowLeft, Check, Clock, Copy, ExternalLink, IdCard, Plus, Search as SearchIcon, Trash2, X } from 'lucide-react'
import { CONTACT_VALUE_LABEL, CONTACT_VALUES, GOALS, normalizeDomain, type ContactValue, type Goal, type Search, type SearchWithPeople, type Person } from '../../shared/types'
import { api, ApiError, isAbort, profileIsEmpty, type Me } from '../lib/api'
import { formatDate, groupByCompany, useAbortable, useCopy, useResource } from '../lib/hooks'
import { researchPrompt } from '../lib/research-prompt'
import { Field } from '../components/Field'
import { ChipInput } from '../components/ChipInput'
import { Badge, GhostBadge } from '../components/Badge'
import { CompanyLogo, LogoCredit } from '../components/CompanyLogo'
import { Intake } from '../components/Intake'
import { Visited } from './Visited'
import posthog from '../lib/posthog'

type Props = { me: Me; refreshMe: () => Promise<void>; searchId?: string }

type SearchForm = { company: string; domain: string; roles: string[]; location: string; goal: Goal | null; contactTypes: ContactValue[]; sharedOnly: boolean }
type Pending = SearchForm & { startedAt: number }
/** Company handed to the form by a booth ("Add a role at …") or a job posting (?company=&role=); `at` re-triggers the same company. */
type Prefill = { company: string; domain: string; role?: string; at: number }

const TAB_LABEL = { searches: 'Searches', contacted: 'Contacted' } as const

export function MapRoute({ me, refreshMe, searchId }: Props) {
  const [, navigate] = useLocation()
  const list = useResource(() => api.searches().then((r) => r.searches), [])
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SearchWithPeople | null>(null)
  // null = automatic: open with no booths yet or a company handed over, folded away otherwise.
  const [formOpen, setFormOpen] = useState<boolean | null>(null)
  const abort = useAbortable()

  // The booth shown is always the one the URL names; anything else is the index.
  const shown = searchId && result?.id === searchId ? result : null

  // Load a saved search when the URL names one we do not hold yet.
  useEffect(() => {
    if (!searchId || result?.id === searchId) return
    let alive = true
    api
      .search(searchId)
      .then((r) => alive && setResult(r.search))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load this search'))
    return () => {
      alive = false
    }
  }, [searchId, result?.id])

  const submit = async (input: SearchForm) => {
    setFormOpen(false)
    setError(null)
    setPending({ ...input, startedAt: Date.now() })
    if (searchId) navigate('/contacts')
    const signal = abort.start()
    // One booth per role, run side by side; the first role that works is shown, the rest wait in the index.
    const results = await Promise.allSettled(
      input.roles.map((role) =>
        api.createSearch({ company: input.company, domain: input.domain, role, location: input.location || undefined, goal: input.goal, contactTypes: input.contactTypes, sharedOnly: input.sharedOnly }, signal),
      ),
    )
    if (signal.aborted) {
      // Cancelled: back to the form with everything still filled in. The server may still finish the booth; the index picks it up.
      setPending(null)
      setFormOpen(true)
      void list.reload()
      return
    }
    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.search] : []))
    const failures = results.flatMap((r) => (r.status === 'rejected' ? [r.reason as unknown] : []))
    for (const search of ok) {
      posthog.capture('search_completed', {
        result_count: search.people.length,
        has_location: Boolean(input.location),
        goal: input.goal,
        role_count: input.roles.length,
        contact_types: input.contactTypes,
        shared_only: input.sharedOnly,
      })
    }
    if (failures.length) {
      const e = failures[0]
      const msg = e instanceof Error ? e.message : 'Search failed'
      setError(input.roles.length > 1 ? `${failures.length} of ${input.roles.length} roles failed: ${msg}` : msg)
    }
    const first = ok[0] ?? failures.map((e) => (e instanceof ApiError ? (e.body as { search?: SearchWithPeople } | null)?.search : undefined)).find(Boolean)
    if (first) {
      setResult(first)
      navigate(`/s/${first.id}`)
    }
    setPending(null)
    void Promise.all([list.reload(), refreshMe()])
  }

  const query = useSearch()
  const [prefill, setPrefill] = useState<Prefill | null>(() => {
    const q = new URLSearchParams(query)
    const company = q.get('company')?.trim()
    return company ? { company, domain: q.get('domain')?.trim() ?? '', role: q.get('role')?.trim() || undefined, at: 1 } : null
  })

  const onPersonChange = (p: Person) => {
    const before = result?.people.find((x) => x.id === p.id)
    setResult((r) => (r ? { ...r, people: r.people.map((x) => (x.id === p.id ? p : x)) } : r))
    // A freshly drafted note cost money; refresh the meter.
    if (before && before.outreach !== p.outreach) void refreshMe()
  }

  // "Find more people": which badge index the latest round started at (those enter animated), and whether it is running.
  const [moreFrom, setMoreFrom] = useState<{ searchId: string; from: number } | null>(null)
  const [moreBusy, setMoreBusy] = useState(false)
  const [moreNote, setMoreNote] = useState<string | null>(null)
  const findMore = async (s: SearchWithPeople) => {
    setError(null)
    setMoreNote(null)
    setMoreFrom({ searchId: s.id, from: s.people.length })
    setMoreBusy(true)
    try {
      const { search, added } = await api.findMore(s.id, abort.start())
      posthog.capture('more_people_found', {
        added_count: added,
        total_result_count: search.people.length,
        round: search.rounds,
      })
      setResult(search)
      if (added === 0) setMoreNote('No new people this round. Try a broader role title or drop the location.')
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : 'Could not find more people')
    } finally {
      setMoreBusy(false)
      void Promise.all([list.reload(), refreshMe()])
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this search and its people?')) return
    try {
      await api.deleteSearch(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this search')
      return
    }
    posthog.capture('search_deleted')
    setResult(null)
    navigate('/contacts')
    void list.reload()
  }

  const params = new URLSearchParams(query)
  const q = params.get('view')
  // ?import: the extension hands over a LinkedIn contact, which the contacted view's listener takes.
  const view = searchId ? 'searches' : q === 'contacted' || params.has('import') ? 'contacted' : 'searches'
  const tabs = (
    <div className="intake">
    <h1 className="display intake__title">People</h1>
    <nav className="posting-tabs" aria-label="People">
      {(['searches', 'contacted'] as const).map((v) => (
        <Link key={v} href={v === 'searches' ? '/contacts' : `/contacts?view=${v}`} aria-current={view === v ? 'page' : undefined}>
          {TAB_LABEL[v]}
        </Link>
      ))}
    </nav>
    </div>
  )

  // Companies moved to Jobs; old links land there.
  if (q === 'companies') return <Redirect to="/jobs?view=companies" replace />
  if (view === 'contacted')
    return (
      <main className="map map--stack">
        {tabs}
        <Visited />
      </main>
    )

  return (
    <main className="map map--stack">
      {tabs}
      {/* "Add a role at …" remounts the form with that booth's company and website filled in. */}
      <IndexCard key={prefill?.at ?? 0} me={me} busy={!!pending} prefill={prefill} open={formOpen ?? (!!prefill || params.has('new') || list.data?.length === 0)} compact={!!(shown || pending)} canClose={!!(shown || pending || list.data?.length)} onToggle={setFormOpen} onSubmit={submit} />

      <section aria-live="polite" aria-busy={!!pending}>
        {pending ? (
          <BoothRunning pending={pending} onCancel={abort.cancel} />
        ) : shown ? (
          <Booth
            search={shown}
            budget={me.budget}
            profile={me.profile}
            error={error}
            note={moreNote}
            busy={moreBusy}
            enterFrom={moreFrom?.searchId === shown.id ? moreFrom.from : 0}
            onPersonChange={onPersonChange}
            onFindMore={() => findMore(shown)}
            onCancel={abort.cancel}
            onAddRole={() => {
              setPrefill({ company: shown.company, domain: shown.domain ?? '', at: Date.now() })
              setFormOpen(true)
              window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
            }}
            onDelete={() => remove(shown.id)}
          />
        ) : searchId && !error ? (
          // A saved search on its way in: hold its place instead of flashing the index.
          <div className="booth">
            <Link href="/contacts" className="booth__back">
              <ArrowLeft aria-hidden="true" /> All searches
            </Link>
            <div className="badge-grid">
              <GhostBadge rank={1} live />
              <GhostBadge rank={2} live />
            </div>
          </div>
        ) : (
          <BoothIndex searches={list.data} loading={list.loading} error={error ?? list.error} />
        )}
      </section>
    </main>
  )
}

/* ---------- The index card (search form) ---------- */

function IndexCard({ me, busy, prefill, open, compact, canClose, onToggle, onSubmit }: { me: Me; busy: boolean; prefill: Prefill | null; open: boolean; compact: boolean; canClose: boolean; onToggle: (open: boolean) => void; onSubmit: (i: SearchForm) => void }) {
  const [company, setCompany] = useState(prefill?.company ?? '')
  const [domain, setDomain] = useState(prefill?.domain ?? '')
  const [roles, setRoles] = useState<string[]>(prefill?.role ? [prefill.role] : [])
  const [roleDraft, setRoleDraft] = useState('')
  const [location, setLocation] = useState('')
  const [goal, setGoal] = useState<Goal | null>(null)
  const [contactTypes, setContactTypes] = useState<ContactValue[]>([])
  const [sharedOnly, setSharedOnly] = useState(false)
  const [touched, setTouched] = useState(false)

  const exhausted = me.budget.used >= me.budget.limit
  const draftRole = roleDraft.trim()
  const submittedRoles = draftRole && !roles.some((role) => role.toLowerCase() === draftRole.toLowerCase()) ? [...roles, draftRole] : roles
  const companyErr = touched && !company.trim() ? 'Name the company.' : null
  const domainErr = touched && domain.trim() && !normalizeDomain(domain) ? 'That website does not look right, e.g. https://www.google.com' : null
  const rolesErr = touched && !submittedRoles.length ? 'Name at least one role you are after.' : null
  const selectedOptions = contactTypes.length + Number(sharedOnly) + Number(!!goal)
  const toggleType = (t: ContactValue) => setContactTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    const host = normalizeDomain(domain)
    if (!company.trim() || (domain.trim() && !host) || !submittedRoles.length || busy || exhausted) return
    onSubmit({ company: company.trim(), domain: host ?? '', roles: submittedRoles, location: location.trim(), goal, contactTypes, sharedOnly })
  }

  return (
    <Intake
      id="index"
      sub
      title="Find the right people to talk to"
      lede="Name a company and a role. Agisse ranks who is worth contacting, says why, and drafts the message you send yourself."
      action="New search"
      open={open}
      compact={compact}
      canClose={canClose}
      onToggle={onToggle}
    >

      <form className="index-card__form" onSubmit={submit} noValidate>
        <Field id="company" label="Company" placeholder="e.g. Google" value={company} onChange={(e) => setCompany(e.target.value)} error={companyErr} autoComplete="organization" autoFocus={!prefill} />
        <Field id="domain" label="Company website" hint="optional · keeps namesakes out" placeholder="e.g. https://www.google.com" type="url" inputMode="url" value={domain} onChange={(e) => setDomain(e.target.value)} error={domainErr} autoFocus={!!prefill?.role} />
        <ChipInput id="roles" autoFocus={!!prefill && !prefill.role} label="Target roles" hint="one search per role · Enter to add" placeholder="e.g. Software Engineer" values={roles} onChange={setRoles} onDraftChange={setRoleDraft} commitOnBlur={false} error={rolesErr} />
        <Field id="location" label="Location" hint="optional" placeholder="e.g. Brussels" value={location} onChange={(e) => setLocation(e.target.value)} />

        <details className="index-card__options">
          <summary>
            <span>Filters and goal</span>
            <span className="index-card__options-hint">
              {selectedOptions ? `${selectedOptions} selected` : 'Optional'}
            </span>
          </summary>
          <div className="index-card__options-fields">
            <div className="field">
              <span className="field__label label" id="types-label">
                <span>Who to show</span>
                <span className="field__hint">none picked shows everyone</span>
              </span>
              <div className="chips" role="group" aria-labelledby="types-label">
                {CONTACT_VALUES.map((t) => (
                  <button key={t} type="button" className="chip" aria-pressed={contactTypes.includes(t)} onClick={() => toggleType(t)}>
                    {CONTACT_VALUE_LABEL[t]}
                  </button>
                ))}
                <button type="button" className="chip" aria-pressed={sharedOnly} onClick={() => setSharedOnly(!sharedOnly)} disabled={profileIsEmpty(me)} title={profileIsEmpty(me) ? 'Fill in your profile first' : undefined}>
                  Shared ground only
                </button>
              </div>
            </div>
            <div className="field">
              <span className="field__label label" id="goal-label">
                <span>Goal</span>
                <span className="field__hint">shapes the ranking and the message</span>
              </span>
              <div className="chips" role="group" aria-labelledby="goal-label">
                {GOALS.map((g) => (
                  <button key={g} type="button" className="chip" aria-pressed={goal === g} onClick={() => setGoal(goal === g ? null : g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>

        {profileIsEmpty(me) && (
          <p className="index-card__profile-nudge">
            <IdCard aria-hidden="true" />
            <span>
              Your profile is blank, so no shared ground can be found. <Link href="/profile">Fill in your profile</Link>.
            </span>
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--sign" disabled={busy || exhausted}>
          {busy ? 'Finding people…' : submittedRoles.length > 1 ? `Find people for ${submittedRoles.length} roles` : 'Find people'}
        </button>
        {exhausted ? (
          <p className="notice" role="status">
            <Clock aria-hidden="true" />
            <span>
              Monthly budget used up. See <Link href="/profile">Profile</Link> for the reset date.
            </span>
          </p>
        ) : null}
      </form>
    </Intake>
  )
}

/* ---------- Running state: ghosts in their slots ---------- */

function BoothRunning({ pending, onCancel }: { pending: Pending; onCancel: () => void }) {
  return (
    <div className="booth">
      <header className="booth__head">
        <div>
          <h2 className="display booth__company">{pending.company}</h2>
          <p className="booth__role">
            {pending.roles.join(', ')}
            {pending.location && <span> · {pending.location}</span>}
            {pending.goal && <span> · {pending.goal}</span>}
          </p>
        </div>
      </header>
      <AiWorking steps={['Finding people at this company', 'Ranking them for you']} expected={30} startedAt={pending.startedAt} onCancel={onCancel} />
      <div className="badge-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <GhostBadge key={i} rank={i + 1} live />
        ))}
      </div>
    </div>
  )
}

/* ---------- Results: the booth and its badges ---------- */

function Booth({
  search,
  budget,
  profile,
  error,
  note,
  busy,
  enterFrom,
  onPersonChange,
  onFindMore,
  onCancel,
  onAddRole,
  onDelete,
}: {
  search: SearchWithPeople
  budget: Me['budget']
  profile: Me['profile']
  error: string | null
  note: string | null
  /** A "find more" round is running for this booth. */
  busy: boolean
  /** Badges from this index on were added by the latest round and enter animated. */
  enterFrom: number
  onPersonChange: (p: Person) => void
  onFindMore: () => void
  onCancel: () => void
  onAddRole: () => void
  onDelete: () => void
}) {
  const contactedCount = search.people.filter((p) => p.contactedAt).length
  const exhausted = budget.used >= budget.limit
  const { copied, copy } = useCopy()
  // The way back to the posting: the seeker's applications at this company (matched by name, as the posting matches its search).
  const jobs = useResource(() => api.jobs().then((r) => r.jobs), [])
  const applications = (jobs.data ?? []).filter((j) => j.company.trim().toLowerCase() === search.company.trim().toLowerCase())
  return (
    <div className="booth">
      <Link href="/contacts" className="booth__back">
        <ArrowLeft aria-hidden="true" /> All searches
      </Link>
      <header className="booth__head">
        <div className="booth__sign">
          <span className="booth__number tnum">
            <small>Search</small>
            {String(search.number).padStart(2, '0')}
          </span>
          <CompanyLogo company={search.company} domain={search.domain} size={56} />
          <div>
            <h2 className="display booth__company">{search.company}</h2>
            <p className="booth__role">
              {search.role}
              {search.location && <span> · {search.location}</span>}
              {search.goal && <span> · {search.goal}</span>}
              {search.contactTypes.length > 0 && <span> · {search.contactTypes.map((t) => CONTACT_VALUE_LABEL[t]).join(', ')}</span>}
              {search.sharedOnly && <span> · shared ground only</span>}
            </p>
            {search.domain && (
              <a className="booth__domain" href={`https://${search.domain}`} target="_blank" rel="noopener noreferrer">
                {search.domain} <ExternalLink aria-hidden="true" />
              </a>
            )}
            {applications.map((j) => (
              <p key={j.id} className="booth__application">
                Your application: <Link href={`/jobs/${j.id}`}>{j.role}</Link> · <span className={`status-pill status-pill--${j.status}`}>{j.status[0]!.toUpperCase() + j.status.slice(1)}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="booth__aside">
          <span className="booth__count tnum">
            {search.people.length} {search.people.length === 1 ? 'person' : 'people'}
          </span>
          <span className="tnum">
            {contactedCount} contacted · {formatDate(search.createdAt)}
          </span>
          <button type="button" className="btn btn--sm btn--quiet" onClick={onAddRole}>
            <Plus aria-hidden="true" /> Add a role
          </button>
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            title="Paste into ChatGPT or Perplexity to read up on the company before you write"
            onClick={() => {
              void copy(researchPrompt(search, profile))
              posthog.capture('research_prompt_copied', { has_location: Boolean(search.location), goal: search.goal })
            }}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy research prompt'}
          </button>
          <button type="button" className="btn btn--sm btn--quiet btn--danger" onClick={onDelete}>
            <Trash2 aria-hidden="true" /> Delete search
          </button>
        </div>
      </header>

      {(error || search.status === 'failed') && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{error ?? search.error ?? 'This search failed.'}</span>
        </p>
      )}

      {search.status === 'done' && search.people.length === 0 && (
        <div className="empty-hall">
          <p className="empty-hall__text">
            No one at <strong>{search.company}</strong> matching <strong>{search.role}</strong> turned up on the public web. Try the company's legal name, a broader role title, or drop the location.
          </p>
          <div className="badge-grid">
            <GhostBadge rank={1} />
            <GhostBadge rank={2} />
          </div>
        </div>
      )}

      {(search.people.length > 0 || busy) && (
        <div className="badge-grid">
          {search.people.map((p, i) => (
            <Badge key={p.id} person={p} draftingAvailable index={Math.max(0, i - enterFrom)} entering={i >= enterFrom} onChange={onPersonChange} />
          ))}
          {busy && Array.from({ length: 4 }, (_, i) => <GhostBadge key={`ghost-${i}`} rank={search.people.length + i + 1} live />)}
        </div>
      )}

      {note && (
        <p className="notice" role="status">
          <SearchIcon aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}

      {search.status === 'done' && (
        <div className="booth__more">
          <button type="button" className="btn btn--ink" onClick={onFindMore} disabled={busy || exhausted} aria-busy={busy}>
            <SearchIcon aria-hidden="true" /> {busy ? 'Searching again…' : 'Find more people'}
          </button>
          {busy && (
            <button type="button" className="btn btn--quiet" onClick={onCancel}>
              <X aria-hidden="true" /> Cancel
            </button>
          )}
          {exhausted ? (
            <span className="booth__more-hint">
              Monthly budget used up. See <Link href="/profile">Profile</Link> for the reset date.
            </span>
          ) : null}
        </div>
      )}

      {search.model && (
        <p className="booth__model">
          Ranked by {search.model.replace(':free', '')} over Exa people search
          {search.rounds > 1 ? ` · ${search.rounds} rounds` : ''}. Verify every claim on the profile before you write.
        </p>
      )}
    </div>
  )
}

/* ---------- Booth index: previous searches ---------- */

function BoothIndex({ searches, loading, error }: { searches: Search[] | null; loading: boolean; error: string | null }) {
  return (
    <div>
      <div className="section-head">
        <h2 className="label">Your searches</h2>
        <span className="label label--muted tnum">{searches ? `${searches.length} ${searches.length === 1 ? 'search' : 'searches'}` : ''}</span>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      {loading && !searches ? (
        <div className="badge-grid">
          <GhostBadge rank={1} live />
          <GhostBadge rank={2} live />
        </div>
      ) : searches && searches.length > 0 ? (
        <ol className="booth-index">
          {groupByCompany(searches).map((g) =>
            g.length === 1 ? (
              <li key={g[0]!.id}>
                <SearchRow s={g[0]!} fallback={searches.length - searches.indexOf(g[0]!)} />
              </li>
            ) : (
              <li key={g[0]!.id} className="company-group">
                <div className="company-group__head">
                  <CompanyLogo company={g[0]!.company} domain={g.find((x) => x.domain)?.domain} />
                  <span className="booth-row__company">{g[0]!.company}</span>
                  <span className="label label--muted tnum">{g.length} searches</span>
                </div>
                <ol className="booth-index">
                  {g.map((x) => (
                    <li key={x.id}>
                      <SearchRow s={x} fallback={searches.length - searches.indexOf(x)} nested />
                    </li>
                  ))}
                </ol>
              </li>
            ),
          )}
        </ol>
      ) : (
        <div className="empty-hall">
          <p className="empty-hall__text">No searches yet.</p>
        </div>
      )}
      {!!searches?.length && <LogoCredit />}
    </div>
  )
}

function SearchRow({ s, fallback, nested }: { s: Search; fallback: number; nested?: boolean }) {
  return (
    <Link href={`/s/${s.id}`} className={`booth-row search-row${nested ? ' job-row--nested' : ''}`}>
      <span className="booth-row__num tnum">{String(s.number ?? fallback).padStart(2, '0')}</span>
      {nested ? <span aria-hidden="true" /> : <CompanyLogo company={s.company} domain={s.domain} />}
      <span className="booth-row__details">
        <span className="booth-row__heading">
          {nested && <span className="sr-only">{s.company}, </span>}
          <span className="booth-row__company">{nested ? s.role : s.company}</span>
          {!nested && s.domain && <span className="booth-row__domain"> · {s.domain}</span>}
        </span>
        <span className="booth-row__role">
          {[nested ? null : s.role, s.location, s.goal].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="booth-row__meta">
        <span className={`booth-row__count tnum${s.status === 'failed' ? ' is-failed' : s.peopleCount === 0 ? ' is-empty' : ''}`}>
          {s.status === 'failed' ? 'Failed' : s.status === 'running' ? 'Running' : `${s.peopleCount} ${s.peopleCount === 1 ? 'person' : 'people'}`}
        </span>
        <span>{formatDate(s.createdAt)}</span>
      </span>
    </Link>
  )
}
