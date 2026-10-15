import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Bookmark, BookmarkCheck, ChevronDown, ExternalLink, IdCard, ListFilter, Search, X } from 'lucide-react'
import { Link, useSearch } from 'wouter'
import type { JobSummary, Profile } from '../../shared/types'
import {
  deadlineLabel, EMPTY_FEED_PREFS, groupByCompany, isBlocked, PROGRAM_LABEL, SPOKEN_LANGUAGES, VACANCY_COUNTRIES, VACANCY_FUNCTIONS, VACANCY_INDUSTRIES,
  type FeedPrefs, type Listing, type Vacancy, type VacancyFacets, type VacancySort,
} from '../../shared/listings'
import { SPONSOR_COUNTRIES } from '../../shared/sponsors'
import { curatedFor, providerGames } from '../../shared/assessment-catalog'
import { providerProfile } from '../../shared/assessments'
import { practiceHref } from '../features/assessments/components/modes'
import { api, isAbort } from '../lib/api'
import { CompanyLogo, LogoCredit } from './CompanyLogo'
import type { OnSave } from './OpenRoles'
import posthog from '../lib/posthog'

type Then = { then?: 'cv' }
type Props = {
  jobs: JobSummary[]
  exhausted: boolean
  /** `then: 'cv'` opens the tailored CV once the evaluation is in, instead of the evaluation. */
  onEvaluate: (listing: Listing, source: 'board' | 'city', opts?: Then) => void
  onSave: OnSave
  profile: Profile | null
  onSavePrefs: (prefs: FeedPrefs) => Promise<unknown>
  /** A role was marked applied from the "Applied to X?" prompt. */
  onApplied: () => void
  /** Waitlisted: tailoring and marking applied open once the account is approved. */
  trial: boolean
}

type View = 'match' | 'soon' | 'new' | 'deadline'
const VIEWS: Record<View, { label: string; sort: VacancySort; deadlineWithin: number | null; newWithin: number | null; empty: string }> = {
  match: { label: 'Best match', sort: 'match', deadlineWithin: null, newWithin: null, empty: 'No roles match these filters.' },
  soon: { label: 'Closing soon', sort: 'deadline', deadlineWithin: 14, newWithin: null, empty: 'Nothing with these filters closes in the next two weeks.' },
  new: { label: 'Just opened', sort: 'new', deadlineWithin: null, newWithin: 7, empty: 'Nothing with these filters opened this week.' },
  deadline: { label: 'All by deadline', sort: 'deadline', deadlineWithin: null, newWithin: null, empty: 'No roles match these filters.' },
}
const PRIMARY_VIEWS: View[] = ['match', 'soon']
const LEVELS = { any: 'All levels', internship: 'Internships', entry: 'Graduate & junior' } as const
const FIT_LABELS = ['Strong fit', 'Worth applying', 'Close to your profile', 'A stretch']
const FUNCTION_NAMES = new Set<string>(Object.values(VACANCY_FUNCTIONS))
const LAST_VISIT = 'agisse.vacancies.lastVisit'
const ASKED = 'agisse.feed.askedApplied'
const cleanUrl = (value: string) => value.replace(/\/$/, '')
const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const LANGUAGE_LABELS = Object.fromEntries(SPOKEN_LANGUAGES.map((l) => [l, cap(l)]))
const COUNTRY_LABELS = VACANCY_COUNTRIES as Record<string, string>
const DAY = 86_400_000
const checkedOpen = (lastSeen: string) => {
  const days = Math.max(0, Math.round((Date.parse(new Date().toLocaleDateString('en-CA')) - Date.parse(lastSeen.slice(0, 10))) / DAY))
  return `Checked open ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}`
}

function readLastVisit(): string | null {
  try {
    const prev = localStorage.getItem(LAST_VISIT)
    localStorage.setItem(LAST_VISIT, new Date().toISOString().slice(0, 10))
    return prev
  } catch {
    return null
  }
}
/** "Did you apply?" is asked once per role per browser session. */
function askedBefore(url: string): boolean {
  try {
    const seen = JSON.parse(sessionStorage.getItem(ASKED) ?? '[]') as string[]
    if (seen.includes(url)) return true
    sessionStorage.setItem(ASKED, JSON.stringify([...seen, url].slice(-200)))
  } catch {
    // No storage: ask anyway.
  }
  return false
}

const whereOf = (v: Vacancy) => (v.country === 'EU' ? 'Remote, Europe' : [v.city, v.country && COUNTRY_LABELS[v.country]].filter(Boolean).join(', '))
const listingOf = (v: Vacancy): Listing => ({ provider: 'feed', company: v.company, title: v.title, location: v.location ?? whereOf(v), url: v.url, text: v.description ?? '', remote: v.remote })
// A stored description goes straight to evaluation; without one the posting is read from its link.
const sourceOf = (v: Vacancy) => (v.description && v.description.length >= 200 ? 'board' : 'city')

/** A filter as a compact menu: a pill that opens a panel of choices. Esc and an outside click close it (see VacancyFeed). */
export function Menu({ label, on, children, wide }: { label: string; on: number; children: ReactNode; wide?: boolean }) {
  return (
    <details className="feed-menu" name="feed-menu">
      <summary className="chip" data-on={on > 0 || undefined}>
        {label}
        {on > 0 && <span className="chip__count">{on}</span>}
        <ChevronDown aria-hidden="true" className="feed-menu__caret" />
      </summary>
      <div className={`feed-menu__panel${wide ? ' feed-menu__panel--wide' : ''}`} role="group" aria-label={label}>
        {children}
      </div>
    </details>
  )
}

/** Esc or a click outside closes an open menu under `root`; Esc hands focus back to its pill. For pointerdown and keydown. */
export function closeMenus(root: HTMLElement | null, e: Event) {
  for (const d of root?.querySelectorAll<HTMLDetailsElement>('details[open]') ?? []) {
    const esc = e instanceof KeyboardEvent
    if (esc ? e.key !== 'Escape' : d.contains(e.target as Node)) continue
    d.open = false
    if (esc) d.querySelector('summary')?.focus()
  }
}

/** Checkbox choices with live counts, busiest first; chosen ones always show, empty ones hide. */
export function Checks({ labels, counts, chosen, onToggle }: { labels: Record<string, string>; counts?: Record<string, number>; chosen: string[]; onToggle: (k: string) => void }) {
  const keys = Object.keys(labels)
    .filter((k) => !counts || chosen.includes(k) || (counts[k] ?? 0) > 0)
    .sort((a, b) => (counts ? (counts[b] ?? 0) - (counts[a] ?? 0) : 0))
  return (
    <div className="feed-checks">
      {keys.map((k) => (
        <label key={k} className="feed-check">
          <input type="checkbox" checked={chosen.includes(k)} onChange={() => onToggle(k)} />
          <span>{labels[k]}</span>
          {counts?.[k] ? <span className="feed-check__n">{counts[k].toLocaleString('en-GB')}</span> : null}
        </label>
      ))}
    </div>
  )
}

/** "Jobs for you": the scraped early-career European vacancies, filtered by the seeker's dealbreakers and ranked by fit. */
export function VacancyFeed({ jobs, exhausted, onEvaluate, onSave, profile, onSavePrefs, onApplied, trial }: Props) {
  const [prefs, setPrefs] = useState<FeedPrefs>(() => ({ ...EMPTY_FEED_PREFS, ...profile?.jobFeed }))
  const [query, setQuery] = useState(prefs.query)
  const [view, setView] = useState<View>('match')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // "More like this": from a row's detail, or ?similar=<url>&title=<title> from a posting's page.
  const search = useSearch()
  const [similar, setSimilar] = useState<{ url: string; title: string } | null>(() => {
    const q = new URLSearchParams(search)
    return q.get('similar') || q.get('title') ? { url: q.get('similar') ?? '', title: q.get('title') ?? '' } : null
  })
  const [items, setItems] = useState<Vacancy[] | null>(null)
  const [more, setMore] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [profiled, setProfiled] = useState(true)
  const [facets, setFacets] = useState<VacancyFacets | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastVisit] = useState(readLastVisit)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [unfolded, setUnfolded] = useState<string[]>([])
  // Roles marked applied from the prompt here, until the reloaded Jobs list has them.
  const [applied, setApplied] = useState<Record<string, string>>({})
  const [asking, setAsking] = useState<{ v: Vacancy; state: 'ask' | 'busy' | 'done' | 'failed'; jobId?: string } | null>(null)
  const leftFor = useRef<Vacancy | null>(null)
  const abort = useRef<AbortController | null>(null)
  const root = useRef<HTMLDivElement>(null)
  // Filters apply to this visit only; "Save as my defaults" writes them to the profile.
  const [saved, setSaved] = useState(() => JSON.stringify(prefs))
  const current = JSON.stringify(prefs)
  const saveDefaults = () => {
    setSaved(current)
    onSavePrefs(prefs).catch(() => {
      setSaved(saved)
      setError('Could not save your defaults')
    })
  }

  // Hiding an employer is saved at once, on top of the saved defaults (unsaved filter changes stay unsaved).
  const setBlocked = (blocked: string[]) => {
    const next = { ...(JSON.parse(saved) as FeedPrefs), blocked }
    setPrefs({ ...prefs, blocked })
    setSaved(JSON.stringify(next))
    onSavePrefs(next).catch(() => setError('Could not save the hidden employers'))
  }

  const load = async (offset: number) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)
    setError(null)
    if (!offset) setItems(null)
    const { sort, deadlineWithin, newWithin } = VIEWS[similar ? 'match' : view]
    try {
      const r = await api.vacancies({ ...prefs, sort, deadlineWithin, newWithin, offset, similar }, controller.signal)
      if (abort.current !== controller) return
      setItems((prev) => (offset ? [...(prev ?? []), ...r.vacancies] : r.vacancies))
      setMore(r.more)
      setTotal(r.total ?? null)
      setProfiled(r.profiled)
      if (!offset) posthog.capture('vacancy_feed_loaded', { sort, view, level: prefs.level, programs: prefs.programs.length, countries: prefs.countries.length, functions: prefs.functions.length, industries: prefs.industries.length, languages: prefs.languages.length, results: r.vacancies.length, total: r.total })
    } catch (err) {
      if (abort.current === controller && !isAbort(err)) setError(err instanceof Error ? err.message : 'Could not load the feed')
    } finally {
      if (abort.current === controller) setLoading(false)
    }
  }

  // Every filter change reloads; typed keywords wait for Enter or leaving the field.
  useEffect(() => {
    void load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, view, similar])
  useEffect(() => {
    // Arriving from a posting's "Similar roles": start at the top, not at the posting's scroll position.
    if (similar) window.scrollTo(0, 0)
    api.vacancyFacets().then(setFacets).catch(() => {})
    // Esc or a click outside closes an open filter or row menu; Esc hands focus back to its pill.
    const close = (e: Event) => closeMenus(root.current, e)
    // Back from a posting's page: ask once whether they applied.
    const back = () => {
      const v = leftFor.current
      if (document.visibilityState !== 'visible' || !v) return
      leftFor.current = null
      if (askedBefore(v.url)) return
      setAsking({ v, state: 'ask' })
      posthog.capture('feed_applied_prompt', { action: 'shown' })
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    document.addEventListener('visibilitychange', back)
    return () => {
      abort.current?.abort()
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
      document.removeEventListener('visibilitychange', back)
    }
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setPrefs({ ...prefs, query: query.trim() })
  }
  const pick = (next: View) => {
    if (next === view) return
    setView(next)
    posthog.capture('feed_view_changed', { view: next })
  }
  const clearAll = () => {
    setQuery('')
    setSimilar(null)
    setPrefs({ ...EMPTY_FEED_PREFS, blocked: prefs.blocked, minSalary: prefs.minSalary })
  }

  const markApplied = async () => {
    if (!asking) return
    const { v } = asking
    setAsking({ v, state: 'busy' })
    try {
      const listing = listingOf(v)
      const jobId = pinned.get(cleanUrl(v.url)) ?? (await api.saveJob({ url: v.url, jdText: listing.text.trim().length >= 200 ? listing.text.trim() : '', save: { company: v.company, role: v.title, location: listing.location || null, deadline: v.deadline } })).job.id
      await api.updateJob(jobId, { status: 'applied' })
      setApplied((a) => ({ ...a, [cleanUrl(v.url)]: jobId }))
      setAsking({ v, state: 'done', jobId })
      onApplied()
      posthog.capture('feed_applied_prompt', { action: 'yes' })
    } catch {
      setAsking({ v, state: 'failed' })
    }
  }

  const pinned = new Map([...jobs.filter((job) => job.url).map((job) => [cleanUrl(job.url!), job.id] as const), ...Object.entries(applied)])
  const visible = (items ?? []).filter((v) => !isBlocked(v.company, prefs))
  const groups = groupByCompany(visible)

  // Selected filters as removable chips under the bar.
  const chosen: { key: string; label: string; remove: () => void }[] = [
    ...(similar ? [{ key: 'similar', label: `Like “${similar.title || 'this role'}”`, remove: () => setSimilar(null) }] : []),
    ...(prefs.query ? [{ key: 'q', label: `“${prefs.query}”`, remove: () => (setQuery(''), setPrefs({ ...prefs, query: '' })) }] : []),
    ...prefs.programs.map((k) => ({ key: `p-${k}`, label: PROGRAM_LABEL[k] ?? k, remove: () => setPrefs({ ...prefs, programs: toggle(prefs.programs, k) }) })),
    ...(prefs.level !== 'any' && prefs.level !== 'experienced' ? [{ key: 'level', label: LEVELS[prefs.level], remove: () => setPrefs({ ...prefs, level: 'any' }) }] : []),
    ...prefs.countries.map((k) => ({ key: `c-${k}`, label: COUNTRY_LABELS[k] ?? k, remove: () => setPrefs({ ...prefs, countries: toggle(prefs.countries, k) }) })),
    ...prefs.functions.map((k) => ({ key: `f-${k}`, label: VACANCY_FUNCTIONS[k as keyof typeof VACANCY_FUNCTIONS] ?? k, remove: () => setPrefs({ ...prefs, functions: toggle(prefs.functions, k) }) })),
    ...prefs.industries.map((k) => ({ key: `i-${k}`, label: VACANCY_INDUSTRIES[k as keyof typeof VACANCY_INDUSTRIES] ?? k, remove: () => setPrefs({ ...prefs, industries: toggle(prefs.industries, k) }) })),
    ...prefs.languages.map((k) => ({ key: `l-${k}`, label: `Speaks ${cap(k)}`, remove: () => setPrefs({ ...prefs, languages: toggle(prefs.languages, k) }) })),
    ...(prefs.remoteOnly ? [{ key: 'remote', label: 'Remote only', remove: () => setPrefs({ ...prefs, remoteOnly: false }) }] : []),
    ...(prefs.sponsorsOnly ? [{ key: 'sponsors', label: 'Visa sponsors', remove: () => setPrefs({ ...prefs, sponsorsOnly: false }) }] : []),
  ]
  const moreOn = prefs.industries.length + prefs.languages.length + (prefs.remoteOnly ? 1 : 0) + (prefs.sponsorsOnly ? 1 : 0)
  const filtersOn = prefs.programs.length + prefs.countries.length + prefs.functions.length + (prefs.level === 'any' ? 0 : 1) + moreOn
  // Nearest neighbours rank every role, so a count says nothing; the order is the point.
  // No open role at all: this copy has no feed provider (docs/feed-contract.md), not a filter problem.
  const noFeed = facets?.total === 0
  const count = similar ? (items ? 'Most similar first' : '') : total != null ? `${total.toLocaleString('en-GB')} ${total === 1 ? 'role' : 'roles'}` : items ? `${visible.length}${more ? '+' : ''} roles` : ''

  const row = (v: Vacancy, sub = false) => (
    <FeedRow
      key={v.url}
      v={v}
      sub={sub}
      jobId={pinned.get(cleanUrl(v.url)) ?? null}
      isNew={lastVisit ? v.firstSeen > lastVisit : Date.now() - Date.parse(v.firstSeen) < 2 * DAY}
      open={expanded === v.url}
      exhausted={exhausted}
      onToggle={() => setExpanded(expanded === v.url ? null : v.url)}
      onSave={onSave}
      onTailor={trial ? undefined : () => {
        posthog.capture('feed_tailor_clicked', { source: sourceOf(v), score: v.score, has_deadline: Boolean(v.deadline) })
        onEvaluate(listingOf(v), sourceOf(v), { then: 'cv' })
      }}
      onHide={() => setBlocked([...prefs.blocked, v.company])}
      onSimilar={() => {
        setSimilar({ url: v.url, title: v.title })
        setExpanded(null)
        root.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
        posthog.capture('feed_similar_clicked', { from: 'row' })
      }}
      onOpen={() => {
        if (!trial) leftFor.current = v
      }}
    />
  )

  return (
    <div className="vacancy-feed" aria-busy={loading} ref={root}>
      <form className="feed-bar" onSubmit={submit} role="search" hidden={noFeed}>
        <label className="feed-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Keywords</span>
          <input type="search" placeholder="Search roles, firms, skills" value={query} onChange={(e) => setQuery(e.target.value)} onBlur={() => query.trim() !== prefs.query && setPrefs({ ...prefs, query: query.trim() })} />
        </label>
        <button type="button" className="chip" data-on={filtersOn > 0 || undefined} aria-expanded={filtersOpen} aria-controls="feed-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
          <ListFilter aria-hidden="true" /> Filters
          {filtersOn > 0 && <span className="chip__count">{filtersOn}</span>}
        </button>
        {filtersOpen && <div className="feed-bar__menus" id="feed-filters">
          <Menu label="Type" on={prefs.programs.length}>
            <Checks labels={PROGRAM_LABEL} counts={facets?.programs} chosen={prefs.programs} onToggle={(k) => setPrefs({ ...prefs, programs: toggle(prefs.programs, k) })} />
          </Menu>
          <Menu label="Level" on={prefs.level === 'any' ? 0 : 1}>
            <div className="feed-checks">
              {(Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((level) => (
                <label key={level} className="feed-check">
                  <input type="radio" name="feed-level" checked={prefs.level === level} onChange={() => setPrefs({ ...prefs, level })} />
                  <span>{LEVELS[level]}</span>
                  {level === 'any' ? (facets ? <span className="feed-check__n">{facets.total.toLocaleString('en-GB')}</span> : null) : facets?.levels[level] ? <span className="feed-check__n">{facets.levels[level].toLocaleString('en-GB')}</span> : null}
                </label>
              ))}
            </div>
          </Menu>
          <Menu label="Country" on={prefs.countries.length}>
            <Checks labels={COUNTRY_LABELS} counts={facets?.countries} chosen={prefs.countries} onToggle={(k) => setPrefs({ ...prefs, countries: toggle(prefs.countries, k) })} />
          </Menu>
          <Menu label="Function" on={prefs.functions.length}>
            <Checks labels={VACANCY_FUNCTIONS} counts={facets?.functions} chosen={prefs.functions} onToggle={(k) => setPrefs({ ...prefs, functions: toggle(prefs.functions, k) })} />
          </Menu>
          <Menu label="More" on={moreOn} wide>
            <div className="feed-menu__section">
              <p className="label">Show only</p>
              <label className="feed-check">
                <input type="checkbox" checked={prefs.remoteOnly} onChange={() => setPrefs({ ...prefs, remoteOnly: !prefs.remoteOnly })} />
                <span>Remote roles</span>
              </label>
              <label className="feed-check" title="Employers on the Dutch (IND) or UK register of visa sponsors">
                <input type="checkbox" checked={prefs.sponsorsOnly} onChange={() => setPrefs({ ...prefs, sponsorsOnly: !prefs.sponsorsOnly })} />
                <span>Visa sponsors (NL, UK)</span>
              </label>
            </div>
            <div className="feed-menu__section">
              <p className="label">Employer type</p>
              <Checks labels={VACANCY_INDUSTRIES} counts={facets?.industries} chosen={prefs.industries} onToggle={(k) => setPrefs({ ...prefs, industries: toggle(prefs.industries, k) })} />
            </div>
            <div className="feed-menu__section">
              <p className="label">Languages you speak <span className="label--muted">hides roles asking for others</span></p>
              <Checks labels={LANGUAGE_LABELS} chosen={prefs.languages} onToggle={(k) => setPrefs({ ...prefs, languages: toggle(prefs.languages, k) })} />
            </div>
            {prefs.blocked.length > 0 && (
              <div className="feed-menu__section">
                <p className="label">Hidden employers</p>
                <ul className="feed-hidden">
                  {prefs.blocked.map((b) => (
                    <li key={b}>
                      <span>{b}</span>
                      <button type="button" className="btn btn--quiet btn--sm" onClick={() => setBlocked(prefs.blocked.filter((x) => x !== b))}>Show again</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Menu>
        </div>}
      </form>

      {(chosen.length > 0 || current !== saved) && (
        <div className="feed-chosen">
          {/* Few results: say so where the filters can be removed. */}
          {items && !loading && chosen.length > 0 && visible.length > 0 && visible.length < 5 && (
            <span className="feed-chosen__thin">Only {visible.length} {visible.length === 1 ? 'role matches' : 'roles match'}. Remove a filter:</span>
          )}
          {chosen.map((c) => (
            <button key={c.key} type="button" className="chip" aria-pressed="true" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
              {c.label}
              <X aria-hidden="true" className="feed-chosen__x" />
            </button>
          ))}
          {/* One chip: its own × already clears it. */}
          {chosen.length > 1 && <button type="button" className="btn btn--quiet btn--sm" onClick={clearAll}>Clear all</button>}
          {current !== saved && <button type="button" className="btn btn--sm feed-chosen__save" onClick={saveDefaults}>Save as my defaults</button>}
        </div>
      )}

      {!profiled && !noFeed && (
        <p className="index-card__profile-nudge">
          <IdCard aria-hidden="true" />
          <span><Link href="/profile">Add your résumé</Link> to rank these by fit.</span>
        </p>
      )}

      <div className="feed-head" hidden={noFeed}>
        {!similar && (
          <div className="feed-head__views">
          <div className="feed-views" role="group" aria-label="View">
            {PRIMARY_VIEWS.map((k) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => pick(k)}>{VIEWS[k].label}</button>
            ))}
          </div>
          <div className="feed-head__more">
            <Menu label={PRIMARY_VIEWS.includes(view) ? 'More' : VIEWS[view].label} on={PRIMARY_VIEWS.includes(view) ? 0 : 1}>
              <div className="feed-checks">
                {(Object.keys(VIEWS) as View[]).filter((k) => !PRIMARY_VIEWS.includes(k)).map((k) => (
                  <label key={k} className="feed-check">
                    <input type="radio" name="feed-view" checked={view === k} onChange={() => pick(k)} />
                    <span>{VIEWS[k].label}</span>
                  </label>
                ))}
              </div>
            </Menu>
          </div>
          </div>
        )}
        <p className="feed-head__count" aria-live="polite">{count}</p>
      </div>

      {error && (
        <p className="notice notice--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={() => void load(0)}>Try again</button>
        </p>
      )}

      {items === null && !error && (
        <ul className="feed-list" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="feed-row feed-row--ghost">
              <span className="feed-ghost feed-ghost--logo" />
              <span className="feed-row__main"><span className="feed-ghost" style={{ width: `${55 + ((i * 17) % 30)}%` }} /><span className="feed-ghost feed-ghost--sm" /></span>
              <span className="feed-ghost feed-ghost--sm feed-row__when" />
            </li>
          ))}
        </ul>
      )}

      {items && visible.length === 0 && !error && (noFeed ? (
        <div className="open-roles__empty">
          <p>No open roles yet: this copy of Agisse has no job feed connected. You can still add any posting yourself and see how well it fits.</p>
          <Link href="/jobs?view=add" className="btn btn--sm">Add a job</Link>
          <p className="muted">Running this copy? <a href="/docs/feed-contract">Connect a feed provider</a></p>
        </div>
      ) : (
        <div className="open-roles__empty">
          <p>{VIEWS[view].empty}</p>
          {chosen.length > 0 ? <button type="button" className="btn btn--sm" onClick={clearAll}>Clear all filters</button> : view !== 'match' && <button type="button" className="btn btn--sm" onClick={() => pick('match')}>Show every role</button>}
        </div>
      ))}

      {visible.length > 0 && (
        <section className="feed-results" aria-label="Roles">
          <ul className="feed-list">
            {groups.map(({ lead, rest }) => {
              const key = lead.company.trim().toLowerCase()
              const shown = unfolded.includes(key)
              return [
                row(lead),
                rest.length > 0 && (
                  <li key={`${lead.url}-more`} className="feed-fold">
                    <button type="button" aria-expanded={shown} onClick={() => setUnfolded(toggle(unfolded, key))}>
                      <ChevronDown aria-hidden="true" />
                      {shown ? `Hide ${rest.length} more at ${lead.company}` : `${rest.length} more at ${lead.company}`}
                    </button>
                  </li>
                ),
                ...(shown ? rest.map((v) => row(v, true)) : []),
              ]
            })}
          </ul>
          <LogoCredit />
          {more && <button type="button" className="btn open-roles__more" disabled={loading} onClick={() => void load(items!.length)}>{loading ? 'Loading…' : 'Show more roles'}</button>}
          {exhausted && (
            <div className="open-roles__allowance" role="status">
              <p>Tailoring is paused while a posting is read, or until your AI limit lifts. <Link href="/profile">See when</Link>.</p>
            </div>
          )}
        </section>
      )}

      {asking && (
        <div className="feed-toast" role="status">
          {asking.state === 'done' ? (
            <>
              <span>Marked applied. <Link href={`/jobs/${asking.jobId}`}>Open in Jobs</Link></span>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setAsking(null)} aria-label="Dismiss"><X aria-hidden="true" /></button>
            </>
          ) : (
            <>
              <span>{asking.state === 'failed' ? 'Could not mark it applied. ' : ''}Applied to <strong>{asking.v.title}</strong> at {asking.v.company}?</span>
              <button type="button" className="btn btn--primary btn--sm" disabled={asking.state === 'busy'} onClick={() => void markApplied()}>{asking.state === 'busy' ? 'Saving…' : asking.state === 'failed' ? 'Try again' : 'Yes'}</button>
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => (setAsking(null), posthog.capture('feed_applied_prompt', { action: 'not_yet' }))}>Not yet</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

type RowProps = {
  v: Vacancy
  sub: boolean
  jobId: string | null
  isNew: boolean
  open: boolean
  exhausted: boolean
  onToggle: () => void
  onSave: OnSave
  onTailor?: () => void
  onHide: () => void
  onSimilar: () => void
  onOpen: () => void
}

/** One role: who and where, the deadline in its own column, save and open; a click opens why it fits and Tailor. */
function FeedRow({ v, sub, jobId, isNew, open, exhausted, onToggle, onSave, onTailor, onHide, onSimilar, onOpen }: RowProps) {
  const [saving, setSaving] = useState<'idle' | 'busy' | 'failed'>('idle')
  const where = whereOf(v)
  const due = deadlineLabel(v)
  const fit = v.reasons.find((r) => FIT_LABELS.includes(r))
  // The deadline has its own column and the functions are tags below, so neither is repeated among the reasons.
  const why = v.reasons.filter((r) => r !== fit && !/^Closes /.test(r) && !r.split(' · ').every((l) => FUNCTION_NAMES.has(l)))
  const process = open ? curatedFor(v.company)[0] : undefined
  const save = async () => {
    setSaving('busy')
    try {
      await onSave(listingOf(v), v.deadline)
      setSaving('idle')
    } catch {
      setSaving('failed')
    }
  }

  return (
    <li
      className={`feed-row${open ? ' is-open' : ''}${sub ? ' feed-row--sub' : ''}`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('a, button, summary, details, input, label')) onToggle()
      }}
    >
      <CompanyLogo company={v.company} domain={v.domain} size={sub ? 32 : 40} />
      <div className="feed-row__main">
        <h3 className="feed-row__title">
          <button type="button" aria-expanded={open} onClick={onToggle}>{v.title}</button>
        </h3>
        <p className="feed-row__meta">
          <span>{v.company}{where ? ` · ${where}` : ''}{v.remote && v.country !== 'EU' ? ' · remote' : ''}</span>
          {isNew && <span className="feed-tag feed-tag--new">New</span>}
        </p>
      </div>
      <div className="feed-row__when">
        <span className={`feed-due feed-due--${due.tone}`}>{due.text}</span>
        {fit && <span className={`feed-fit${fit === 'A stretch' ? ' feed-fit--muted' : ''}`}>{fit}</span>}
      </div>
      <div className="feed-row__actions">
        {jobId ? (
          <Link className="feed-icon is-on" href={`/jobs/${jobId}`} aria-label={`Saved: open ${v.title} in Jobs`} title="Saved to Jobs">
            <BookmarkCheck aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" className="feed-icon" disabled={saving === 'busy'} onClick={() => void save()} aria-label={`Save ${v.title} at ${v.company}`} title={saving === 'failed' ? 'Could not save. Try again' : 'Save to Jobs'} data-failed={saving === 'failed' || undefined}>
            <Bookmark aria-hidden="true" />
          </button>
        )}
        <a className="feed-icon" href={v.url} target="_blank" rel="noreferrer" onClick={onOpen} aria-label={`Open the ${v.title} posting`} title="Open the posting">
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
      {open && (
        <div className="feed-row__detail">
          {why.length > 0 && <p className="feed-row__why">{why.join(' · ')}</p>}
          {v.sponsors.length > 0 && (
            <p className="feed-row__sponsor" title="The employer's name is on this country's public register of visa sponsors. Check the register for the exact entity.">
              Recognised visa sponsor ({v.sponsors.map((c) => SPONSOR_COUNTRIES[c]).join(', ')})
            </p>
          )}
          {v.description ? <p className="feed-row__excerpt">{v.description.slice(0, 600)}</p> : <p className="feed-row__excerpt feed-row__excerpt--none">No description stored. Open the posting to read it.</p>}
          {(v.program || v.functions.length > 0) && (
            <ul className="feed-row__tags" aria-label="Type and functions">
              {v.program && <li className="feed-tag">{PROGRAM_LABEL[v.program] ?? v.program}</li>}
              {v.functions.map((f) => <li key={f} className="feed-tag">{VACANCY_FUNCTIONS[f as keyof typeof VACANCY_FUNCTIONS] ?? f}</li>)}
            </ul>
          )}
          {process && (
            <div className="feed-row__process">
              <ol aria-label={`${v.company} selection process`}>
                {process.stages.map((s) => <li key={s}>{s.replace(/^\d+\.\s*/, '').split(/[:(]/)[0]!.trim()}</li>)}
              </ol>
              {process.provider && providerGames(process.provider).length > 0 && (
                <Link href={practiceHref(null, 'simulation', providerGames(process.provider).map((g) => g.id))}>
                  Prep: {providerProfile(process.provider)?.name ?? process.provider}
                </Link>
              )}
            </div>
          )}
          <p className="feed-row__foot">
            <span>{checkedOpen(v.lastSeen)}</span>
            {onTailor && <button type="button" className="btn btn--sm btn--primary" disabled={exhausted} onClick={onTailor} title="Checks fit, then opens your CV tailored to it">Tailor my CV</button>}
            <button type="button" className="btn btn--sm" onClick={onSimilar}>Similar roles</button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={onHide}>Hide roles at {v.company}</button>
          </p>
          {/* ponytail: CV / cover letter / written-answer badges wait for the scraper to record which materials a posting asks for. */}
        </div>
      )}
    </li>
  )
}
