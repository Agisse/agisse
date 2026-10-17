import { AiWorking } from '@/components/AiWorking'
import { lazy, Suspense, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { AlertCircle, Check, Clock, ExternalLink, IdCard, Network, Plus, Star, Trash2, X } from 'lucide-react'
import { COMPANY_SIZE_LABEL, COMPANY_SIZES, type CompanySize, type SavedCompany, type Scout, type ScoutInput, type ScoutPick } from '../../shared/types'
import { api, isAbort, profileIsEmpty, type Me } from '../lib/api'
import { boothHref, formatDate, companyNameKey as key, remembered, useAbortable, useResource } from '../lib/hooks'
import { Field, TextField } from '../components/Field'
import { ChipInput } from '../components/ChipInput'
import { CompanyLogo, LogoCredit } from '../components/CompanyLogo'
import { Intake } from '../components/Intake'
import { Segmented } from '../components/Segmented'
import posthog from '../lib/posthog'

const MAX_DREAM = 5
type Mode = 'dream' | 'describe'

const scoutTitle = (input: ScoutInput) => (input.dream.length ? `Like ${input.dream.join(', ')}` : input.description)

// The force graph is heavy; only the Map layout loads it.
const BubbleMapRoute = lazy(() => import('./BubbleMap').then((m) => ({ default: m.BubbleMapRoute })))
const LAYOUTS = ['list', 'map'] as const
type Layout = (typeof LAYOUTS)[number]

/** Jobs › Companies: the company searches as a list, or the bubble map. The choice is remembered per user. */
export function CompaniesView({ me, refreshMe, scoutId }: { me: Me; refreshMe: () => Promise<void>; scoutId?: string }) {
  const [, navigate] = useLocation()
  const asked = new URLSearchParams(useSearch()).get('layout')
  const pref = `companies-layout.${me.user.id}`
  const layout: Layout = scoutId ? 'list' : asked === 'list' || asked === 'map' ? asked : remembered(pref, LAYOUTS, 'list')
  const choose = (l: Layout) => {
    remembered(pref, LAYOUTS, 'list', l)
    navigate(`/jobs?view=companies&layout=${l}`)
  }
  return (
    <div className="map--stack companies">
      <Segmented label="Show companies as" value={layout} options={[['list', 'List'], ['map', 'Map']]} onChange={choose} />
      {layout === 'map' ? <Suspense fallback={<div className="bubble-map__empty" aria-busy="true" />}><BubbleMapRoute me={me} /></Suspense> : <ScoutRoute me={me} refreshMe={refreshMe} scoutId={scoutId} />}
    </div>
  )
}

const scoutHref = (id: string) => `/scout/${id}`

function ScoutRoute({ me, refreshMe, scoutId: picked }: { me: Me; refreshMe: () => Promise<void>; scoutId?: string }) {
  const [, navigate] = useLocation()
  const list = useResource(() => api.scouts().then((r) => r.scouts), [])
  // Nothing picked: the latest search opens, so Companies never lands on an empty page when there are results.
  const scoutId = picked ?? list.data?.[0]?.id
  const shortlist = useResource(() => api.shortlist().then((r) => r.companies), [])
  const [scout, setScout] = useState<Scout | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [pending, setPending] = useState<{ input: ScoutInput; startedAt: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState<boolean | null>(null)
  const abort = useAbortable()
  // Until the list answers, this browser's last answer draws the form, so it doesn't open (or fold) under the seeker.
  const [hadSearches] = useState(() => remembered('companies', ['some', 'none'], 'none') === 'some')
  useEffect(() => {
    if (list.data) remembered('companies', ['some', 'none'], 'none', list.data.length ? 'some' : 'none')
  }, [list.data])

  // The form lives here so "+ Dream list" on a stop can feed the next scout.
  const [mode, setMode] = useState<Mode>('dream')
  const [dream, setDream] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [sizes, setSizes] = useState<CompanySize[]>([])
  const [useProfile, setUseProfile] = useState(() => !profileIsEmpty(me))
  const [exclude, setExclude] = useState<string[]>([])

  useEffect(() => {
    if (!scoutId) return setScout(null)
    if (scout?.id === scoutId) return
    let alive = true
    api
      .scout(scoutId)
      .then((r) => alive && setScout(r.scout))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoutId])

  const run = async (input: ScoutInput) => {
    setError(null)
    setPending({ input, startedAt: Date.now() })
    setFormOpen(false)
    try {
      const { scout: s } = await api.createScout(input, abort.start())
      posthog.capture('scout_run', { dream: input.dream.length, has_description: !!input.description, sizes: input.sizes, use_profile: input.useProfile, picks: s.result.picks.length })
      setScout(s)
      setFresh(s.id)
      navigate(scoutHref(s.id))
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : 'Could not find companies')
      setFormOpen(true)
    } finally {
      setPending(null)
      void Promise.all([list.reload(), refreshMe()])
    }
  }

  const addToDream = (name: string) => {
    setDream((cur) => (cur.some((d) => key(d) === key(name)) ? cur : [...cur, name].slice(-MAX_DREAM)))
    setMode('dream')
    setFormOpen(true)
    posthog.capture('scout_dream_added')
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const saved = new Map((shortlist.data ?? []).map((c) => [key(c.name), c]))
  const toggleSave = async (p: { name: string; domain: string | null; why: string | null }) => {
    const hit = saved.get(key(p.name))
    try {
      if (hit) {
        shortlist.setData((cur) => cur?.filter((c) => c.id !== hit.id) ?? null)
        await api.unsaveCompany(hit.id)
      } else {
        const { company } = await api.saveCompany(p)
        shortlist.setData((cur) => [company, ...(cur ?? []).filter((c) => c.id !== company.id)])
        posthog.capture('company_saved')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the shortlist')
      void shortlist.reload()
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this company search?')) return
    await api.deleteScout(id)
    posthog.capture('scout_deleted')
    setScout(null)
    navigate('/jobs?view=companies&layout=list')
    void list.reload()
  }

  const shown = scoutId && scout?.id === scoutId ? scout : null
  const searched = list.data ? list.data.length > 0 : hadSearches
  const open = formOpen ?? !searched
  const form = { mode, setMode, dream, setDream, description, setDescription, location, setLocation, sizes, setSizes, useProfile, setUseProfile, exclude, setExclude }

  return (
    <>
      <ScoutForm me={me} busy={!!pending} open={open} compact={!!(shown || pending || scoutId || searched)} canClose={!!(shown || pending || scoutId || searched)} onToggle={setFormOpen} onSubmit={run} {...form} />

      {error && !pending && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <div className="scout">
        <section className="scout__main" aria-live="polite" aria-busy={!!pending}>
          {pending ? (
            <RouteRunning input={pending.input} startedAt={pending.startedAt} onCancel={abort.cancel} />
          ) : shown ? (
            <RouteView scout={shown} entering={fresh === shown.id} saved={saved} onSave={toggleSave} onDream={addToDream} onDelete={() => remove(shown.id)} />
          ) : scoutId || list.loading ? (
            <RouteGhost text="Loading companies" live />
          ) : (
            <RouteGhost text="Companies appear here, best fit first." />
          )}
        </section>

        <aside className="scout__aside">
          <Shortlist companies={shortlist.data} loading={shortlist.loading} onRemove={(c) => toggleSave(c)} />
          <PastScouts scouts={list.data} current={scoutId} />
        </aside>
      </div>
    </>
  )
}

/* ---------- The form ---------- */

type FormState = {
  mode: Mode
  setMode: (m: Mode) => void
  dream: string[]
  setDream: (v: string[]) => void
  description: string
  setDescription: (v: string) => void
  location: string
  setLocation: (v: string) => void
  sizes: CompanySize[]
  setSizes: (v: CompanySize[]) => void
  useProfile: boolean
  setUseProfile: (v: boolean) => void
  exclude: string[]
  setExclude: (v: string[]) => void
}

function ScoutForm({ me, busy, open, compact, canClose, onToggle, onSubmit, ...f }: FormState & { me: Me; busy: boolean; open: boolean; compact: boolean; canClose: boolean; onToggle: (open: boolean) => void; onSubmit: (i: ScoutInput) => void }) {
  const [draft, setDraft] = useState('')
  const [touched, setTouched] = useState(false)
  const exhausted = me.budget.used >= me.budget.limit
  const blankBadge = profileIsEmpty(me)
  const d = draft.trim()
  const dream = d && !f.dream.some((x) => key(x) === key(d)) ? [...f.dream, d] : f.dream
  const described = f.description.trim()
  const empty = !dream.length && described.length < 10
  const dreamErr = dream.length > MAX_DREAM ? `Keep it to ${MAX_DREAM} dream companies.` : null
  const emptyErr = touched && empty ? 'Add a dream company or describe the kind of company (a sentence is enough).' : null
  const filters = f.sizes.length + Number(!!f.location.trim()) + f.exclude.length + Number(f.useProfile && !blankBadge)
  const toggleSize = (s: CompanySize) => f.setSizes(f.sizes.includes(s) ? f.sizes.filter((x) => x !== s) : [...f.sizes, s])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (empty || dreamErr || busy || exhausted) return
    f.setDream(dream)
    setDraft('')
    onSubmit({ dream, description: described, location: f.location.trim(), sizes: f.sizes, useProfile: f.useProfile && !blankBadge, exclude: f.exclude })
  }

  return (
    <Intake
      id="scout"
      sub
      title="Find companies to target"
      lede="Start from companies you love, or describe the kind you are after. Agisse returns the best fits, with the reason for each."
      action="New search"
      open={open}
      compact={compact}
      canClose={canClose}
      onToggle={onToggle}
    >
      <form className="index-card__form" onSubmit={submit} noValidate>
        <div className="seg" role="group" aria-label="Start from">
          <button type="button" aria-pressed={f.mode === 'dream'} onClick={() => f.setMode('dream')}>
            Dream list{f.dream.length > 0 && <span className="scout__tab-count tnum"> · {f.dream.length}</span>}
          </button>
          <button type="button" aria-pressed={f.mode === 'describe'} onClick={() => f.setMode('describe')}>
            Describe{described && <Check aria-hidden="true" className="scout__tab-check" />}
          </button>
        </div>

        <div>
          {f.mode === 'dream' ? (
            <ChipInput id="dream" label="Dream companies" hint={`up to ${MAX_DREAM} · Enter to add`} placeholder="e.g. Adyen" values={f.dream} onChange={f.setDream} onDraftChange={setDraft} commitOnBlur={false} error={dreamErr ?? emptyErr} autoFocus={open} />
          ) : (
            <TextField id="describe" label="The kind of company" hint={`${described.length} / 1000`} placeholder="e.g. A B2B software scale-up in Belgium where a business engineer can work on pricing and data, with a graduate programme." maxLength={1000} rows={4} value={f.description} onChange={(e) => f.setDescription(e.target.value)} error={emptyErr} autoFocus={open} />
          )}
        </div>

        <details className="index-card__options">
          <summary>
            <span>Filters</span>
            <span className="index-card__options-hint">{filters ? `${filters} set` : 'Optional'}</span>
          </summary>
          <div className="index-card__options-fields">
            <Field id="scout-location" label="Location" hint="city, country or region" placeholder="e.g. Belgium" value={f.location} onChange={(e) => f.setLocation(e.target.value)} />
            <div className="field">
              <span className="field__label label" id="size-label">
                <span>Company size</span>
                <span className="field__hint">any if none picked</span>
              </span>
              <div className="chips" role="group" aria-labelledby="size-label">
                {COMPANY_SIZES.map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={f.sizes.includes(s)} onClick={() => toggleSize(s)}>
                    {COMPANY_SIZE_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field__label label" id="badge-label">
                <span>Your profile</span>
                <span className="field__hint">explains where your background fits</span>
              </span>
              <div className="chips" role="group" aria-labelledby="badge-label">
                <button type="button" className="chip" aria-pressed={f.useProfile && !blankBadge} disabled={blankBadge} title={blankBadge ? 'Fill in your profile first' : undefined} onClick={() => f.setUseProfile(!f.useProfile)}>
                  Match against my profile
                </button>
              </div>
            </div>
            <ChipInput id="exclude" label="Leave out" hint="companies you already know" placeholder="e.g. Deloitte" values={f.exclude} onChange={f.setExclude} />
          </div>
        </details>

        {blankBadge && (
          <p className="index-card__profile-nudge">
            <IdCard aria-hidden="true" />
            <span>
              Your profile is blank. <Link href="/profile">Fill it in</Link> to see where your background fits each company.
            </span>
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--sign" disabled={busy || exhausted}>
          {busy ? 'Finding companies…' : 'Find companies'}
        </button>
        {exhausted && (
          <p className="notice" role="status">
            <Clock aria-hidden="true" />
            <span>
              Monthly budget used up. See <Link href="/profile">Profile</Link> for the reset date.
            </span>
          </p>
        )}
      </form>
    </Intake>
  )
}

/* ---------- The route ---------- */

type Zone = { name: string; stops: Array<{ pick: ScoutPick; n: number }> }

/** Picks arrive best first; zones keep that order by their best stop, and stops are numbered down the route. */
function zonesOf(picks: ScoutPick[]): Zone[] {
  const byName = new Map<string, ScoutPick[]>()
  for (const p of picks) byName.set(key(p.cluster), [...(byName.get(key(p.cluster)) ?? []), p])
  let n = 0
  return [...byName.values()].map((ps) => ({ name: ps[0]!.cluster, stops: ps.map((pick) => ({ pick, n: ++n })) }))
}

function RouteView({ scout, entering, saved, onSave, onDream, onDelete }: { scout: Scout; entering: boolean; saved: Map<string, SavedCompany>; onSave: (p: { name: string; domain: string | null; why: string | null }) => void; onDream: (name: string) => void; onDelete: () => void }) {
  const { input, result } = scout
  const zones = zonesOf(result.picks)
  const stops = result.picks.length
  const filters = [input.location, input.sizes.map((s) => COMPANY_SIZE_LABEL[s]).join(' or '), input.useProfile && 'matched to your profile', input.exclude.length > 0 && `${input.exclude.length} left out`].filter(Boolean)
  return (
    <div className={`route${entering ? ' is-entering' : ''}`} style={{ '--stops': stops } as CSSProperties}>
      <header className="route__head">
        <div>
          <h2 className="display route__title">{scoutTitle(input)}</h2>
          {filters.length > 0 && <p className="route__filters">{filters.join(' · ')}</p>}
        </div>
        <div className="booth__aside">
          <span className="booth__count tnum">
            {stops} {stops === 1 ? 'company' : 'companies'}
          </span>
          <span className="tnum">
            {result.candidates} companies read · {formatDate(scout.createdAt)}
          </span>
          <button type="button" className="btn btn--sm btn--quiet btn--danger" onClick={onDelete}>
            <Trash2 aria-hidden="true" /> Delete search
          </button>
        </div>
      </header>

      <ol className="route__path">
        <Entrance input={input} />

        {stops === 0 && (
          <li className="route__none">
            <p>No company fit every filter. Loosen size or location, or add a dream company, and search again.</p>
          </li>
        )}

        {zones.map((z) => (
          <li key={z.name} className="route__zone">
            <h3 className="route__zone-sign">{z.name}</h3>
            <ol className="route__stops">
              {z.stops.map(({ pick, n }) => (
                <Stop key={pick.domain} pick={pick} n={n} saved={saved.has(key(pick.name))} dreamed={input.dream.some((d) => key(d) === key(pick.name))} onSave={() => onSave({ name: pick.name, domain: pick.domain, why: pick.why })} onDream={() => onDream(pick.name)} />
              ))}
            </ol>
          </li>
        ))}

      </ol>
      <LogoCredit />
    </div>
  )
}

function Entrance({ input }: { input: ScoutInput }) {
  return (
    <li className="route__entrance">
      <span className="route__sign">Your search</span>
      {input.dream.length > 0 && (
        <ul className="route__dream" aria-label="Dream companies">
          {input.dream.map((d) => (
            <li key={d}>
              <CompanyLogo company={d} size={24} /> {d}
            </li>
          ))}
        </ul>
      )}
      {input.description && <p className="route__described">“{input.description}”</p>}
    </li>
  )
}

function Stop({ pick, n, saved, dreamed, onSave, onDream }: { pick: ScoutPick; n: number; saved: boolean; dreamed: boolean; onSave: () => void; onDream: () => void }) {
  const f = pick.facts
  const fromWikidata = !!pick.sourceUrl && /^https:\/\/(www\.)?wikidata\.org\//.test(pick.sourceUrl)
  const facts = f ? [f.industry, f.country, f.employees && `${f.employees.toLocaleString()} people`, f.founded && `since ${f.founded}`].filter(Boolean) : []
  return (
    <li className="stop" style={{ '--i': n } as CSSProperties}>
      <span className="stop__marker tnum">
        {String(n).padStart(2, '0')}
      </span>
      <div className="stop__body">
        <div className="stop__head">
          <CompanyLogo company={pick.name} domain={pick.domain} size={40} />
          <div className="stop__id">
            <h4 className="stop__name">{pick.name}</h4>
            <span className="stop__meta">
              <a className="stop__domain" href={`https://${pick.domain}`} target="_blank" rel="noopener noreferrer">
                {pick.domain} <ExternalLink aria-hidden="true" />
              </a>
              {pick.unverified && <span className="stop__tag">Model suggestion · verify</span>}
            </span>
          </div>
        </div>
        {pick.what && <p className="stop__what">{pick.what}</p>}
        {pick.why && (
          <p className="stop__why">
            <span className="label">Why</span> {pick.why}
          </p>
        )}
        {/* What it is and why it fits decide; the profile match and the sources open on demand. */}
        {(pick.profileFit || facts.length > 0 || pick.sourceUrl) && (
          <details className="req__fold stop__fold">
            <summary>{pick.profileFit ? 'Your fit and facts' : 'Facts'}</summary>
            {pick.profileFit && (
              <p className="stop__fit">
                <span className="stop__fit-kind">Your profile</span> {pick.profileFit}
              </p>
            )}
            {(facts.length > 0 || pick.sourceUrl) && (
              <p className="stop__facts">
                {facts.length > 0 && <span className="tnum">{facts.join(' · ')}</span>}
                {pick.sourceUrl && (
                  <a href={pick.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {fromWikidata ? 'Wikidata' : 'Source'} <ExternalLink aria-hidden="true" />
                  </a>
                )}
                {f && !fromWikidata && (
                  <a href={`https://www.wikidata.org/wiki/${f.qid}`} target="_blank" rel="noopener noreferrer">
                    Wikidata <ExternalLink aria-hidden="true" />
                  </a>
                )}
              </p>
            )}
          </details>
        )}
        <div className="stop__actions">
          <Link href={boothHref(pick)} className="btn btn--sm" onClick={() => posthog.capture('booth_opened_from_scout', { source: pick.source })}>
            Find people
          </Link>
          <details className="stop__more">
            <summary className="btn btn--sm btn--quiet">More</summary>
            <div className="stop__actions">
              <button type="button" className="btn btn--sm btn--quiet" aria-pressed={saved} onClick={onSave}>
                <Star aria-hidden="true" className={saved ? 'is-filled' : undefined} /> {saved ? 'Saved' : 'Save'}
              </button>
              <Link href={`/jobs?${new URLSearchParams({ careers: pick.name, domain: pick.domain })}`} className="btn btn--sm btn--quiet">
                Open roles
              </Link>
              <Link href={`/jobs?${new URLSearchParams({ view: 'companies', layout: 'map', company: pick.name, domain: pick.domain })}`} className="btn btn--sm btn--quiet">
                <Network aria-hidden="true" /> Map around this
              </Link>
              <button type="button" className="btn btn--sm btn--quiet" disabled={dreamed} onClick={onDream}>
                {dreamed ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />} {dreamed ? 'On your dream list' : 'Dream list'}
              </button>
            </div>
          </details>
        </div>
      </div>
    </li>
  )
}

/* ---------- Absence and waiting: ghost stops on a dashed route ---------- */

function RouteRunning({ input, startedAt, onCancel }: { input: ScoutInput; startedAt: number; onCancel: () => void }) {
  return (
    <div className="route">
      <header className="route__head">
        <h2 className="display route__title">{scoutTitle(input)}</h2>
      </header>
      <AiWorking steps={['Finding companies that fit', 'Checking open company data']} expected={30} startedAt={startedAt} onCancel={onCancel} />
      <GhostStops live entrance={<Entrance input={input} />} />
    </div>
  )
}

function RouteGhost({ text, live = false }: { text: string; live?: boolean }) {
  return (
    <div className="route">
      {/* While loading, the line keeps its height and only screen readers hear it (the section is a live region). */}
      <p className="empty-hall__text">{live ? <><span className="sr-only">{text}</span>{'\u00a0'}</> : text}</p>
      <GhostStops live={live} />
    </div>
  )
}

function GhostStops({ live, entrance }: { live: boolean; entrance?: ReactNode }) {
  return (
    <ol className={`route__path route__path--ghost${live ? ' is-live' : ''}`}>
      {entrance}
      {[62, 48, 74, 55].map((w, i) => (
        <li key={i} className="stop stop--ghost" aria-hidden="true">
          <span className="stop__marker">{String(i + 1).padStart(2, '0')}</span>
          <div className="stop__body">
            <span className="ghost-line ghost-line--name" style={{ width: `${w * 0.6}%` }} />
            <span className="ghost-line" style={{ width: `${w + 20}%` }} />
            <span className="ghost-line" style={{ width: `${w}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ---------- Aside: shortlist and past scouts ---------- */

function Shortlist({ companies, loading, onRemove }: { companies: SavedCompany[] | null; loading: boolean; onRemove: (c: SavedCompany) => void }) {
  return (
    <section aria-labelledby="shortlist-title">
      <div className="section-head">
        <h2 id="shortlist-title" className="label">
          Shortlist
        </h2>
        <span className="booth-row__count tnum">{companies?.length ?? (loading ? null : 0)}</span>
      </div>
      {!companies?.length ? (
        <p className="scout__hint">{loading ? <><span className="sr-only">Loading the shortlist</span>{'\u00a0'}</> : 'Save a company to keep it here.'}</p>
      ) : (
        <ul className="booth-index">
          {companies.map((c) => (
            <li key={c.id} className="saved-row">
              <CompanyLogo company={c.name} domain={c.domain} size={32} />
              <Link href={boothHref(c)} className="saved-row__name" title={c.why ?? undefined} onClick={() => posthog.capture('booth_opened_from_scout', { source: 'shortlist' })}>
                {c.name}
              </Link>
              <button type="button" className="chip__x" aria-label={`Remove ${c.name} from the shortlist`} onClick={() => onRemove(c)}>
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PastScouts({ scouts, current }: { scouts: Array<{ id: string; input: ScoutInput; picks: number; createdAt: string }> | null; current?: string }) {
  if (!scouts?.length) return null
  return (
    <section aria-labelledby="past-title">
      <div className="section-head">
        <h2 id="past-title" className="label">
          Past searches
        </h2>
        <span className="booth-row__count tnum">{scouts.length}</span>
      </div>
      <ul className="booth-index">
        {scouts.map((s) => (
          <li key={s.id}>
            <Link href={scoutHref(s.id)} className="booth-row scout-row" aria-current={s.id === current ? 'page' : undefined}>
              <span className="booth-row__details">
                <span className="booth-row__company">{scoutTitle(s.input)}</span>
                <span className="booth-row__role">{formatDate(s.createdAt)}</span>
              </span>
              <span className={`booth-row__count tnum${s.picks ? '' : ' is-empty'}`}>{s.picks} {s.picks === 1 ? 'company' : 'companies'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
