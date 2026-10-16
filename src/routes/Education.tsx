import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bookmark, BookmarkCheck, ListFilter, Search, X } from 'lucide-react'
import { deadlineLabel } from '../../shared/listings'
import { countryLabel, EMPTY_PROGRAMME_FILTERS, fieldLabel, languageLabel, PROGRAMME_KINDS, STUDY_MODES, type Programme, type ProgrammeFacets, type ProgrammeFilters } from '../../shared/programmes'
import { api, isAbort } from '../lib/api'
import { CompanyLogo, LogoCredit } from '../components/CompanyLogo'
import { Checks, closeMenus, Menu } from '../components/VacancyFeed'

type View = 'match' | 'soon' | 'saved'
const VIEWS: Record<View, { label: string; empty: string }> = {
  match: { label: 'Best match', empty: 'No programmes match these filters.' },
  soon: { label: 'Closing soon', empty: 'Nothing with these filters closes in the next 30 days.' },
  saved: { label: 'Saved', empty: 'Nothing saved yet. Tap the bookmark on a programme to keep it here.' },
}
const TUITION = [5000, 10000, 20000, 40000]
const eur = (n: number) => `€${n.toLocaleString('en-GB')}`
const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])
const labelsOf = (counts: Record<string, number> | undefined, label: (k: string) => string) => Object.fromEntries(Object.keys(counts ?? {}).map((k) => [k, label(k)]))
const whereOf = (p: Programme) => [p.city, p.country && countryLabel(p.country)].filter(Boolean).join(', ')
const monthYear = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

/** Education: master's, MBA and PhD programmes and funded PhD positions, ranked for the seeker. Built from the job feed's parts. */
export function EducationRoute() {
  const [filters, setFilters] = useState<ProgrammeFilters>(EMPTY_PROGRAMME_FILTERS)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('match')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [items, setItems] = useState<Programme[] | null>(null)
  const [more, setMore] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [facets, setFacets] = useState<ProgrammeFacets | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const root = useRef<HTMLDivElement>(null)

  const load = async (offset: number) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)
    setError(null)
    if (!offset) setItems(null)
    try {
      const r = await api.programmes({ ...filters, soon: view === 'soon', saved: view === 'saved' }, offset, controller.signal)
      if (abort.current !== controller) return
      setItems((prev) => (offset ? [...(prev ?? []), ...r.programmes] : r.programmes))
      setMore(r.more)
      setTotal(r.total)
    } catch (err) {
      if (abort.current === controller && !isAbort(err)) setError(err instanceof Error ? err.message : 'Could not load programmes')
    } finally {
      if (abort.current === controller) setLoading(false)
    }
  }

  useEffect(() => {
    void load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, view])
  useEffect(() => {
    api.programmeFacets().then(setFacets).catch(() => {})
    const close = (e: Event) => closeMenus(root.current, e)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      abort.current?.abort()
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFilters({ ...filters, q: query.trim() })
  }
  const clearAll = () => {
    setQuery('')
    setFilters(EMPTY_PROGRAMME_FILTERS)
  }
  const setSaved = (url: string, saved: boolean) => setItems((xs) => xs && xs.map((p) => (p.url === url ? { ...p, saved } : p)))

  const chosen: { key: string; label: string; remove: () => void }[] = [
    ...(filters.q ? [{ key: 'q', label: `“${filters.q}”`, remove: () => (setQuery(''), setFilters({ ...filters, q: '' })) }] : []),
    ...filters.kinds.map((k) => ({ key: `k-${k}`, label: PROGRAMME_KINDS[k as keyof typeof PROGRAMME_KINDS] ?? k, remove: () => setFilters({ ...filters, kinds: toggle(filters.kinds, k) }) })),
    ...filters.countries.map((k) => ({ key: `c-${k}`, label: countryLabel(k), remove: () => setFilters({ ...filters, countries: toggle(filters.countries, k) }) })),
    ...filters.fields.map((k) => ({ key: `f-${k}`, label: fieldLabel(k), remove: () => setFilters({ ...filters, fields: toggle(filters.fields, k) }) })),
    ...filters.languages.map((k) => ({ key: `l-${k}`, label: `Taught in ${languageLabel(k)}`, remove: () => setFilters({ ...filters, languages: toggle(filters.languages, k) }) })),
    ...(filters.maxTuition != null ? [{ key: 'fee', label: `Up to ${eur(filters.maxTuition)} a year`, remove: () => setFilters({ ...filters, maxTuition: null }) }] : []),
  ]
  const filtersOn = chosen.length - (filters.q ? 1 : 0)
  // Nothing open at all: the provider is still filling the table, or this copy has none (docs/education-contract.md).
  const noData = facets?.total === 0

  if (noData) {
    return (
      <main className="map map--stack">
        <div className="intake">
          <h1 className="display intake__title">Education</h1>
          <div className="open-roles__empty">
            <p>Master's, MBA and PhD programmes are on their way, from the world's top universities and business schools, with funded PhD positions as they open.</p>
            <p className="muted">Running this copy? <a href="/docs/education-contract">Connect a programme provider</a></p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="map map--stack">
      <div className="intake">
        <h1 className="display intake__title">Education</h1>
        <div className="vacancy-feed" aria-busy={loading} ref={root}>
          <form className="feed-bar" onSubmit={submit} role="search">
            <label className="feed-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Keywords</span>
              <input type="search" placeholder="Search programmes, universities" value={query} onChange={(e) => setQuery(e.target.value)} onBlur={() => query.trim() !== filters.q && setFilters({ ...filters, q: query.trim() })} />
            </label>
            <button type="button" className="chip" data-on={filtersOn > 0 || undefined} aria-expanded={filtersOpen} aria-controls="edu-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
              <ListFilter aria-hidden="true" /> Filters
              {filtersOn > 0 && <span className="chip__count">{filtersOn}</span>}
            </button>
            {filtersOpen && (
              <div className="feed-bar__menus" id="edu-filters">
                <Menu label="Type" on={filters.kinds.length}>
                  <Checks labels={PROGRAMME_KINDS} counts={facets?.kinds} chosen={filters.kinds} onToggle={(k) => setFilters({ ...filters, kinds: toggle(filters.kinds, k) })} />
                </Menu>
                <Menu label="Country" on={filters.countries.length}>
                  <Checks labels={labelsOf(facets?.countries, countryLabel)} counts={facets?.countries} chosen={filters.countries} onToggle={(k) => setFilters({ ...filters, countries: toggle(filters.countries, k) })} />
                </Menu>
                <Menu label="Field" on={filters.fields.length}>
                  <Checks labels={labelsOf(facets?.fields, fieldLabel)} counts={facets?.fields} chosen={filters.fields} onToggle={(k) => setFilters({ ...filters, fields: toggle(filters.fields, k) })} />
                </Menu>
                <Menu label="Language" on={filters.languages.length}>
                  <Checks labels={labelsOf(facets?.languages, languageLabel)} counts={facets?.languages} chosen={filters.languages} onToggle={(k) => setFilters({ ...filters, languages: toggle(filters.languages, k) })} />
                </Menu>
                <Menu label="Tuition" on={filters.maxTuition == null ? 0 : 1}>
                  <div className="feed-checks">
                    {[null, ...TUITION].map((n) => (
                      <label key={n ?? 'any'} className="feed-check">
                        <input type="radio" name="edu-fee" checked={filters.maxTuition === n} onChange={() => setFilters({ ...filters, maxTuition: n })} />
                        <span>{n == null ? 'Any fee' : `Up to ${eur(n)} a year`}</span>
                      </label>
                    ))}
                  </div>
                </Menu>
              </div>
            )}
          </form>

          {chosen.length > 0 && (
            <div className="feed-chosen">
              {chosen.map((c) => (
                <button key={c.key} type="button" className="chip" aria-pressed="true" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                  {c.label}
                  <X aria-hidden="true" className="feed-chosen__x" />
                </button>
              ))}
              {chosen.length > 1 && <button type="button" className="btn btn--quiet btn--sm" onClick={clearAll}>Clear all</button>}
            </div>
          )}

          <div className="feed-head">
            <div className="feed-head__views">
              <div className="feed-views" role="group" aria-label="View">
                {(Object.keys(VIEWS) as View[]).map((k) => (
                  <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>{VIEWS[k].label}</button>
                ))}
              </div>
            </div>
            <p className="feed-head__count" aria-live="polite">{total != null ? `${total.toLocaleString('en-GB')} ${total === 1 ? 'programme' : 'programmes'}` : ''}</p>
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

          {items?.length === 0 && !error && (
            <div className="open-roles__empty">
              <p>{VIEWS[view].empty}</p>
              {chosen.length > 0 && <button type="button" className="btn btn--sm" onClick={clearAll}>Clear all filters</button>}
            </div>
          )}

          {!!items?.length && (
            <section className="feed-results" aria-label="Programmes">
              <ul className="feed-list">
                {items.map((p) => (
                  <ProgrammeRow key={p.url} p={p} open={expanded === p.url} onToggle={() => setExpanded(expanded === p.url ? null : p.url)} onSaved={(saved) => setSaved(p.url, saved)} />
                ))}
              </ul>
              <LogoCredit />
              {more && <button type="button" className="btn open-roles__more" disabled={loading} onClick={() => void load(items.length)}>{loading ? 'Loading…' : 'Show more programmes'}</button>}
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

/** One programme: what and where, the deadline and save; a click shows the facts and the one way out, the official page. */
function ProgrammeRow({ p, open, onToggle, onSaved }: { p: Programme; open: boolean; onToggle: () => void; onSaved: (saved: boolean) => void }) {
  const [saving, setSaving] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [full, setFull] = useState<Programme | null>(null)
  useEffect(() => {
    if (open && !full) api.programme(p.url).then(setFull, () => {})
  }, [open, full, p.url])
  const due = p.closedAt ? { text: 'Closed', tone: 'muted' as const } : deadlineLabel(p)
  const where = whereOf(p)
  const save = async () => {
    setSaving('busy')
    try {
      await api.saveProgramme(p.url, !p.saved)
      onSaved(!p.saved)
      setSaving('idle')
    } catch {
      setSaving('failed')
    }
  }
  const facts = [
    p.school !== p.institution && p.school,
    p.degree,
    p.durationMonths && `${p.durationMonths} months`,
    p.studyMode && STUDY_MODES[p.studyMode],
    p.startDate && `Starts ${monthYear(p.startDate)}`,
    p.tuitionEur != null && (p.tuitionEur === 0 ? 'No tuition' : `${eur(p.tuitionEur)} a year`),
    p.languages.length > 0 && `Taught in ${p.languages.map(languageLabel).join(', ')}`,
    p.rank && `${p.rank.by} #${p.rank.n}`,
  ].filter(Boolean)
  const extras = (['funding', 'scholarships', 'gmat', 'supervisor'] as const)
    .map((k) => [k, full?.details?.[k]] as const)
    .filter((e): e is readonly [typeof e[0], string | number] => typeof e[1] === 'string' || typeof e[1] === 'number')

  return (
    <li className={`feed-row${open ? ' is-open' : ''}`} onClick={(e) => !(e.target as HTMLElement).closest('a, button') && onToggle()}>
      <CompanyLogo company={p.institution} domain={p.domain} size={40} />
      <div className="feed-row__main">
        <h3 className="feed-row__title">
          <button type="button" aria-expanded={open} onClick={onToggle}>{p.title}</button>
        </h3>
        <p className="feed-row__meta">
          <span>{p.institution}{where ? ` · ${where}` : ''}</span>
          {p.kind === 'phd_position' && <span className="feed-tag">Funded</span>}
        </p>
      </div>
      <div className="feed-row__when">
        <span className={`feed-due feed-due--${due.tone}`}>{due.text}</span>
      </div>
      <div className="feed-row__actions">
        <button type="button" className={`feed-icon${p.saved ? ' is-on' : ''}`} disabled={saving === 'busy'} onClick={() => void save()} aria-pressed={p.saved} aria-label={`${p.saved ? 'Saved' : 'Save'}: ${p.title} at ${p.institution}`} title={saving === 'failed' ? 'Could not save. Try again' : p.saved ? 'Saved' : 'Save'} data-failed={saving === 'failed' || undefined}>
          {p.saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div className="feed-row__detail">
          {facts.length > 0 && <p className="feed-row__sponsor">{facts.join(' · ')}</p>}
          {full?.description && <p className="feed-row__excerpt">{full.description}</p>}
          {extras.map(([k, v]) => (
            <p key={k} className="feed-row__sponsor"><strong>{k === 'gmat' ? 'GMAT' : languageLabel(k)}:</strong> {v}</p>
          ))}
          {p.fields.length > 0 && (
            <ul className="feed-row__tags" aria-label="Fields">
              {p.fields.map((f) => <li key={f} className="feed-tag">{fieldLabel(f)}</li>)}
            </ul>
          )}
          <p className="feed-row__foot">
            <a className="btn btn--sm btn--primary edu-apply" href={p.url} target="_blank" rel="noreferrer">Apply on {p.institution}</a>
          </p>
        </div>
      )}
    </li>
  )
}
