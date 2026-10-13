import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { Link } from 'wouter'
import type { JobSummary, SavedCompany } from '../../shared/types'
import { ADZUNA_COUNTRIES, findOpenRoles, type Listing, type ListingBoard } from '../../shared/listings'
import { api, isAbort } from '../lib/api'
import { Field } from './Field'
import posthog from '../lib/posthog'

type Mode = 'board' | 'city'
type Props = {
  mode: Mode
  jobs: JobSummary[]
  exhausted: boolean
  onEvaluate: (listing: Listing, source: 'board' | 'city') => void
  onSave: OnSave
  onPaste: () => void
  /** Careers page only: the company to check, prefilled. */
  initial?: { name: string; domain: string } | null
}

const PROVIDER = { greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', personio: 'Personio', recruitee: 'Recruitee', workable: 'Workable', smartrecruiters: 'SmartRecruiters' } as const
const cleanUrl = (value: string) => value.replace(/\/$/, '')

export type OnSave = (listing: Listing, deadline: string | null) => Promise<unknown>

/** Free: puts the role on the board as Saved, to evaluate later. */
export function SaveRole({ listing, deadline = null, onSave }: { listing: Listing; deadline?: string | null; onSave: OnSave }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const save = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await onSave(listing, deadline)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className="btn btn--sm btn--quiet" disabled={busy} onClick={() => void save()} aria-label={`Save ${listing.title} at ${listing.company}`}>
      {busy ? 'Saving…' : failed ? 'Retry save' : 'Save'}
    </button>
  )
}

export function OpenRoles({ mode, jobs, exhausted, onEvaluate, onSave, onPaste, initial }: Props) {
  const [company, setCompany] = useState(initial?.name ?? '')
  const [domain, setDomain] = useState(initial?.domain ?? '')
  const [what, setWhat] = useState('')
  const [where, setWhere] = useState('')
  const [country, setCountry] = useState<keyof typeof ADZUNA_COUNTRIES>('be')
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [boards, setBoards] = useState<ListingBoard[]>([])
  const [shortlist, setShortlist] = useState<SavedCompany[] | null>(null)
  const [titleFilter, setTitleFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [unreachable, setUnreachable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromShortlist, setFromShortlist] = useState(false)
  const [visibleLimit, setVisibleLimit] = useState(15)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (mode !== 'board' || shortlist) return
    let alive = true
    api
      .shortlist()
      .then((r) => alive && setShortlist(r.companies))
      .catch(() => alive && setShortlist([]))
    return () => {
      alive = false
    }
  }, [mode, shortlist])

  useEffect(
    () => () => {
      abort.current?.abort()
      abort.current = null
    },
    [],
  )

  const search = async (e: FormEvent) => {
    e.preventDefault()
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)
    setError(null)
    setUnreachable(false)
    setListings(null)
    setBoards([])
    try {
      if (mode === 'board') {
        const result = await findOpenRoles(company.trim(), domain.trim(), controller.signal)
        if (abort.current !== controller) return
        setListings(result.listings)
        setBoards(result.boards)
        setUnreachable(result.unreachable)
        posthog.capture('open_roles_searched', { mode, boards: result.boards.length, results: result.listings.length, from_shortlist: fromShortlist })
      } else {
        const result = await api.listings({ what: what.trim(), where: where.trim(), country }, controller.signal)
        if (abort.current !== controller) return
        setListings(result.listings)
        posthog.capture('open_roles_searched', { mode, boards: 0, results: result.listings.length, from_shortlist: false })
      }
    } catch (err) {
      if (abort.current === controller && !isAbort(err)) setError(err instanceof Error ? err.message : 'Could not find open roles')
    } finally {
      if (abort.current === controller) setLoading(false)
    }
  }

  const pinned = useMemo(() => new Map(jobs.filter((job) => job.url).map((job) => [cleanUrl(job.url!), job.id])), [jobs])
  const filtered = useMemo(() => {
    const title = titleFilter.trim().toLowerCase()
    const city = cityFilter.trim().toLowerCase()
    return (listings ?? []).filter((listing) => (!title || listing.title.toLowerCase().includes(title)) && (!city || listing.location.toLowerCase().includes(city)))
  }, [listings, titleFilter, cityFilter])
  const available = filtered.slice(0, 50)
  const shown = available.slice(0, visibleLimit)

  const choose = (saved: SavedCompany) => {
    setCompany(saved.name)
    setDomain(saved.domain ?? '')
    setFromShortlist(true)
  }

  return (
    <div className="open-roles" aria-busy={loading}>
      <form className="open-roles__search" onSubmit={search}>
        {mode === 'board' ? (
          <>
            {shortlist && shortlist.length > 0 && (
              <div className="field">
                <span className="field__label label">From your shortlist</span>
                <div className="chips" aria-label="Shortlisted companies">
                  {shortlist.map((saved) => (
                    <button key={saved.id} type="button" className="chip" aria-pressed={company === saved.name} onClick={() => choose(saved)}>
                      {saved.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="index-card__row">
              <Field id="roles-company" label="Company" placeholder="e.g. Stripe" required value={company} onChange={(e) => { setCompany(e.target.value); setFromShortlist(false) }} />
              <Field id="roles-domain" label="Website" hint="optional" placeholder="stripe.com" value={domain} onChange={(e) => { setDomain(e.target.value); setFromShortlist(false) }} />
            </div>
          </>
        ) : (
          <>
            <div className="index-card__row">
              <Field id="roles-what" label="Role or keywords" placeholder="e.g. analyst" required value={what} onChange={(e) => setWhat(e.target.value)} />
              <Field id="roles-where" label="City or region" placeholder="e.g. Brussels" required value={where} onChange={(e) => setWhere(e.target.value)} />
            </div>
            <label className="field" htmlFor="roles-country">
              <span className="field__label label">Country</span>
              <select id="roles-country" className="field__input" value={country} onChange={(e) => setCountry(e.target.value as keyof typeof ADZUNA_COUNTRIES)}>
                {Object.entries(ADZUNA_COUNTRIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
          </>
        )}
        <button type="submit" className="btn btn--primary" disabled={loading || (mode === 'board' ? !company.trim() : mode === 'city' ? !what.trim() || !where.trim() : false)}>
          <Search aria-hidden="true" /> {loading ? 'Checking open roles…' : mode === 'board' ? 'Check public boards' : 'Search by city'}
        </button>
      </form>

      {loading && <p className="sr-only" role="status">Checking the live boards…</p>}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      {unreachable && <p className="notice notice--error" role="alert">Couldn't reach the job boards. Try again.</p>}
      {!unreachable && listings?.length === 0 && mode === 'board' && (
        <div className="open-roles__empty">
          <p>No public board for {company.trim()} on Greenhouse, Lever, Ashby, Personio, Recruitee, Workable or SmartRecruiters. Workday and own-site careers pages don't show here; copy the posting from their site.</p>
          <button type="button" className="btn btn--sm" onClick={onPaste}>Paste a posting</button>
        </div>
      )}
      {listings?.length === 0 && mode === 'city' && <p className="open-roles__empty">No matching roles found. Try broader keywords or a nearby city.</p>}

      {boards.length > 0 && (
        <ul className="open-roles__sources" aria-label="Boards found">
          {boards.map((board) => <li key={board.url}><span className="label">{PROVIDER[board.provider]}</span> · <a href={board.url} target="_blank" rel="noreferrer">{new URL(board.url).host}{new URL(board.url).pathname}<ExternalLink aria-hidden="true" /></a></li>)}
        </ul>
      )}

      {listings && listings.length > 0 && (
        <section className="open-roles__results" aria-label="Open roles">
          {listings.length > 15 && <div className="open-roles__filters">
            <Field id="roles-title-filter" label="Filter by title" placeholder="e.g. analyst" value={titleFilter} onChange={(e) => { setTitleFilter(e.target.value); setVisibleLimit(15) }} />
            <Field id="roles-city-filter" label="Filter by city" placeholder="e.g. Brussels" value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setVisibleLimit(15) }} />
          </div>}
          <p className="open-roles__count label">{Math.min(50, filtered.length)} of {listings.length}{shown.length < available.length ? ` · showing ${shown.length}` : ''}</p>
          {filtered.length === 0 && (
            <div className="open-roles__empty">
              <p>No roles match those filters.</p>
              <button type="button" className="btn btn--sm" onClick={() => { setTitleFilter(''); setCityFilter(''); setVisibleLimit(15) }}>Clear filters</button>
            </div>
          )}
          <ul className="open-roles__list">
            {shown.map((listing) => {
              const jobId = pinned.get(cleanUrl(listing.url))
              const source = mode
              return (
                <li key={listing.url} className="open-role">
                  <div className="open-role__body">
                    <h3>{listing.title}</h3>
                    <p>{listing.company}{listing.location ? ` · ${listing.location}` : ''}</p>
                  </div>
                  <a className="open-role__link" href={listing.url} target="_blank" rel="noreferrer" aria-label={`Open ${listing.title} posting`}>Open <ExternalLink aria-hidden="true" /></a>
                  {jobId ? (
                    <Link className="open-role__pinned" href={`/jobs/${jobId}`}>Saved to Jobs</Link>
                  ) : (
                    <div className="open-role__action">
                      <SaveRole listing={listing} onSave={onSave} />
                      <button type="button" className="btn btn--sm" disabled={exhausted} onClick={() => onEvaluate(listing, source)} aria-label={`Check fit for ${listing.title} at ${listing.company}`}>Check fit</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {shown.length < available.length && <button type="button" className="btn open-roles__more" onClick={() => setVisibleLimit(50)}>Show {available.length - shown.length} more roles</button>}
          {exhausted && (
            <div className="open-roles__allowance" role="status">
              <p>Your monthly limit is reached, so new roles cannot be checked yet. <Link href="/profile">Review usage in Profile.</Link></p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
