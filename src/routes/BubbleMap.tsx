import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { AlertCircle, Bookmark, Clock, ExternalLink, Maximize, Minus, Network, Plus, Star, Trash2 } from 'lucide-react'
import { normalizeDomain, type BubbleMapSummary, type MapBubble, type SavedCompany } from '../../shared/types'
import { api, isAbort, type Me } from '../lib/api'
import { boothHref, formatDate, companyNameKey as key, useAbortable, useResource } from '../lib/hooks'
import { Field } from '../components/Field'
import { CompanyLogo, LogoCredit, logoUrl } from '../components/CompanyLogo'
import posthog from '../lib/posthog'

type Bubble = Omit<MapBubble, 'x' | 'y'>
type Node = NodeObject<Bubble>
type Edge = LinkObject<Bubble>

/** A bubble's id: its website host when known, else its name. */
const idOf = (name: string, domain: string | null) => domain ?? `name:${key(name)}`
/** force-graph swaps link ends for the node objects once it has laid them out. */
const endId = (end: Edge['source']) => (typeof end === 'object' ? end.id : end) as string

/** Where a map lives: inside Jobs › Companies, shown as a map. */
const mapHref = (m: { id?: string; name: string; domain: string | null }) => `/jobs?${new URLSearchParams({ view: 'companies', layout: 'map', company: m.name, ...(m.domain ? { domain: m.domain } : {}), ...(m.id ? { map: m.id } : {}) })}`

/** Jobs › Companies › Map: grow a map of companies outward from one you like. */
export function BubbleMapRoute({ me }: { me: Me }) {
  const [, navigate] = useLocation()
  const q = new URLSearchParams(useSearch())
  const company = q.get('company')?.trim() ?? ''
  const domain = normalizeDomain(q.get('domain') ?? '')
  // Bumped on every start or open, so the board resets even when the company stays the same.
  const [run, setRun] = useState(0)
  const maps = useResource(() => api.bubbleMaps().then((r) => r.maps), [])
  const shortlist = useResource(() => api.shortlist().then((r) => r.companies), [])

  const start = (seed: { name: string; domain: string | null }) => {
    posthog.capture('bubble_map_started', { has_domain: !!seed.domain })
    setRun((r) => r + 1)
    navigate(mapHref(seed))
  }

  return (
    <>
      {company ? (
        <>
          <div className="bubble-map__head">
            <h2 className="bubble-map__title">
              <CompanyLogo company={company} domain={domain} size={28} /> Around {company}
            </h2>
            <Link href="/jobs?view=companies&layout=map" className="btn btn--sm btn--quiet">
              <Plus aria-hidden="true" /> New map
            </Link>
          </div>
          <Board key={`${company}|${domain}|${run}`} me={me} seed={{ name: company, domain }} mapId={q.get('map')} onSaved={() => void maps.reload()} />
        </>
      ) : (
        <StartMap shortlist={shortlist.data ?? []} onStart={start} />
      )}
      <SavedMaps
        maps={maps.data}
        current={q.get('map')}
        onOpen={() => setRun((r) => r + 1)}
        onDelete={async (m) => {
          if (!confirm(`Delete the saved map of ${m.name}?`)) return
          maps.setData((cur) => cur?.filter((x) => x.id !== m.id) ?? null)
          await api.deleteBubbleMap(m.id).catch(() => maps.reload())
        }}
      />
    </>
  )
}

/** The empty map: one field to start from, and the shortlist as one-click seeds. */
function StartMap({ shortlist, onStart }: { shortlist: SavedCompany[]; onStart: (seed: { name: string; domain: string | null }) => void }) {
  const [name, setName] = useState('')
  const [site, setSite] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) onStart({ name: name.trim(), domain: normalizeDomain(site) })
  }
  return (
    <section className="bubble-map__empty" aria-labelledby="map-start-title">
      <Network aria-hidden="true" className="bubble-map__empty-icon" />
      <h2 id="map-start-title" className="bubble-map__empty-title">Map the companies around one you like</h2>
      <p className="bubble-map__empty-text">Pick a company. Similar ones gather around it; click any of them to grow the map further.</p>
      <form className="bubble-map__start" onSubmit={submit}>
        <Field id="bubble-company" label="Company" placeholder="e.g. Adyen" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
        <Field id="bubble-domain" label="Website" hint="optional" placeholder="e.g. adyen.com" inputMode="url" value={site} onChange={(e) => setSite(e.target.value)} />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          Start the map
        </button>
      </form>
      {shortlist.length > 0 && (
        <div className="bubble-map__seeds">
          <span className="label label--muted">Or start from your shortlist</span>
          <div className="chips">
            {shortlist.slice(0, 8).map((c) => (
              <button key={c.id} type="button" className="chip" onClick={() => onStart({ name: c.name, domain: c.domain })}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function SavedMaps({ maps, current, onOpen, onDelete }: { maps: BubbleMapSummary[] | null; current: string | null; onOpen: (m: BubbleMapSummary) => void; onDelete: (m: BubbleMapSummary) => void }) {
  if (!maps?.length) return null
  return (
    <section aria-labelledby="saved-maps-title">
      <div className="section-head">
        <h2 id="saved-maps-title" className="label">
          Saved maps
        </h2>
        <span className="booth-row__count tnum">{maps.length}</span>
      </div>
      <ul className="booth-index">
        {maps.map((m) => (
          <li key={m.id} className="bubble-map__saved">
            <Link href={mapHref(m)} className="booth-row scout-row" aria-current={m.id === current ? 'page' : undefined} onClick={() => onOpen(m)}>
              <CompanyLogo company={m.name} domain={m.domain} size={24} />
              <span className="booth-row__details">
                <span className="booth-row__company">Around {m.name}</span>
                <span className="booth-row__role">Saved {formatDate(m.updatedAt)}</span>
              </span>
              <span className="booth-row__count tnum">{m.companies} companies</span>
            </Link>
            <button type="button" className="btn btn--sm btn--quiet btn--danger" onClick={() => onDelete(m)} aria-label={`Delete the saved map of ${m.name}`}>
              <Trash2 aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Board({ me, seed, mapId, onSaved }: { me: Me; seed: { name: string; domain: string | null }; mapId: string | null; onSaved: () => void }) {
  const root: Node = { id: idOf(seed.name, seed.domain), name: seed.name, domain: seed.domain, what: '', why: null, unverified: false, facts: null, depth: 0 }
  const [graph, setGraph] = useState<{ nodes: Node[]; links: Edge[] }>({ nodes: [root], links: [] })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string>(root.id)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useAbortable()
  const fg = useRef<ForceGraphMethods<Node, Edge>>(undefined)
  // When the layout settles, frame this bubble and its neighbours: the seed on open, the bubble just grown after a grow.
  const fitNext = useRef<string | null>(idOf(seed.name, seed.domain))
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const palette = useRef<string[]>([])
  const ink = useRef({ ink: '', blue: '', link: '' })
  const shortlist = useResource(() => api.shortlist().then((r) => r.companies), [])
  const exhausted = me.budget.used >= me.budget.limit
  const [, navigate] = useLocation()
  // The saved copy this board writes to; set when opened from the list or on the first save.
  const savedId = useRef(mapId)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!mapId)

  useEffect(() => {
    if (!mapId) return
    api
      .bubbleMap(mapId)
      .then(({ map }) => {
        const nodes: Node[] = map.data.nodes.map((n) => ({ ...n }))
        setGraph({ nodes, links: map.data.links.map(([source, target]) => ({ source, target })) })
        setExpanded(new Set(map.data.expanded))
        fitNext.current = root.id
      })
      .catch((e: Error) => {
        savedId.current = null
        setError(e.message)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    const id = savedId.current ?? crypto.randomUUID()
    setSaving(true)
    setError(null)
    try {
      const nodes: MapBubble[] = graph.nodes.map(({ id, name, domain, what, why, unverified, facts, depth, x, y }) => ({ id, name, domain, what, why, unverified, facts, depth, x, y }))
      await api.saveBubbleMap(id, { name: seed.name, domain: seed.domain, data: { nodes, links: graph.links.map((l) => [endId(l.source), endId(l.target)]), expanded: [...expanded] } })
      if (!savedId.current) {
        savedId.current = id
        // Same company and domain, so the board keeps its key and stays as it is; a reload opens the saved copy.
        navigate(mapHref({ id, ...seed }), { replace: true })
      }
      setDirty(false)
      posthog.capture('bubble_map_saved', { companies: nodes.length })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this map')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const css = getComputedStyle(document.documentElement)
    palette.current = ['none', 1, 2, 3, 4, 5, 6].map((i) => css.getPropertyValue(`--bubble-${i}`).trim())
    ink.current = { ink: css.getPropertyValue('--ink').trim(), blue: css.getPropertyValue('--blue').trim(), link: css.getPropertyValue('--status-saved').trim() }
    const el = box.current!
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }))
    ro.observe(el)
    // Two-finger scroll moves the map, as in any canvas app; pinch (ctrlKey) or Ctrl/⌘ + wheel still reach d3's zoom.
    const onWheel = (e: WheelEvent) => {
      const g = fg.current
      if (!g || e.ctrlKey || e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const k = g.zoom()
      const c = g.centerAt()
      g.centerAt(c.x + (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) / k, c.y + (e.shiftKey ? 0 : e.deltaY) / k)
    }
    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [])

  const fit = (ms = REDUCED() ? 0 : 400) => fg.current?.zoomToFit(ms, 48)
  const frame = (id: string) => {
    const near = new Set([id])
    for (const l of graph.links) {
      if (endId(l.source) === id) near.add(endId(l.target))
      if (endId(l.target) === id) near.add(endId(l.source))
    }
    const n = graph.nodes.find((x) => x.id === id)
    // A lone bubble would fill the frame; keep it at a readable size instead.
    if (near.size === 1 && n) fg.current?.centerAt(n.x, n.y, REDUCED() ? 0 : 400).zoom(2, REDUCED() ? 0 : 400)
    else fg.current?.zoomToFit(REDUCED() ? 0 : 400, 56, (x) => near.has(x.id as string))
  }
  const zoomBy = (f: number) => fg.current?.zoom(fg.current.zoom() * f, REDUCED() ? 0 : 200)

  // Spread bubbles out so logos and labels do not pile up.
  useEffect(() => {
    fg.current?.d3Force('charge')?.strength?.(-220)
    fg.current?.d3Force('link')?.distance?.(70)
  }, [size.width])

  const node = graph.nodes.find((n) => n.id === selected) ?? null
  const degree = (id: string) => graph.links.filter((l) => endId(l.source) === id || endId(l.target) === id).length

  const expand = async (n: Node) => {
    if (busy || exhausted || expanded.has(n.id)) return
    setError(null)
    setBusy(n.id)
    try {
      const { companies } = await api.similarCompanies({ name: n.name, domain: n.domain }, abort.start())
      setGraph((g) => {
        const have = new Set(g.nodes.map((x) => x.id))
        const linked = new Set(g.links.map((l) => [endId(l.source), endId(l.target)].sort().join('|')))
        const nodes = [...g.nodes]
        const links = [...g.links]
        for (const c of companies) {
          const id = idOf(c.name, c.domain)
          // New companies start next to their parent; ones already on the map only get the link, which is how clusters show.
          if (!have.has(id)) {
            have.add(id)
            nodes.push({ id, name: c.name, domain: c.domain, what: c.what, why: c.why, unverified: c.unverified, facts: c.facts, depth: n.depth + 1, x: (n.x ?? 0) + Math.random() * 20 - 10, y: (n.y ?? 0) + Math.random() * 20 - 10 })
          }
          const pair = [n.id, id].sort().join('|')
          if (!linked.has(pair) && id !== n.id) {
            linked.add(pair)
            links.push({ source: n.id, target: id })
          }
        }
        return { nodes, links }
      })
      setExpanded((s) => new Set(s).add(n.id))
      fitNext.current = n.id
      setDirty(true)
      posthog.capture('bubble_expanded', { depth: n.depth, added_count: companies.length })
      if (!companies.length) setError(`Nothing like ${n.name} turned up on the public web. Try another bubble.`)
    } catch (e) {
      if (!isAbort(e)) setError(e instanceof Error ? e.message : 'Could not grow this bubble')
    } finally {
      setBusy(null)
    }
  }

  const remove = (n: Node) => {
    setGraph((g) => ({ nodes: g.nodes.filter((x) => x.id !== n.id), links: g.links.filter((l) => endId(l.source) !== n.id && endId(l.target) !== n.id) }))
    setSelected(root.id)
    setDirty(true)
  }

  const click = (n: Node) => {
    if (n.id === selected) void expand(n)
    else setSelected(n.id)
  }

  const saved = new Map((shortlist.data ?? []).map((c) => [key(c.name), c]))
  const toggleSave = async (n: Node) => {
    const hit = saved.get(key(n.name))
    try {
      if (hit) {
        shortlist.setData((cur) => cur?.filter((c) => c.id !== hit.id) ?? null)
        await api.unsaveCompany(hit.id)
      } else {
        const { company } = await api.saveCompany({ name: n.name, domain: n.domain, why: n.why || n.what || null })
        shortlist.setData((cur) => [company, ...(cur ?? []).filter((c: SavedCompany) => c.id !== company.id)])
        posthog.capture('company_saved', { source: 'bubble_map' })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the shortlist')
      void shortlist.reload()
    }
  }

  const radius = (n: Node) => (n.facts?.employees ? 6 + 3 * Math.log10(n.facts.employees) : 9) + (n.depth === 0 ? 4 : 0)
  const fill = (n: Node) => palette.current[n.facts?.industry ? tint(n.facts.industry) : 0]!
  // The legend names the industries on the map, most common first; the tints repeat past six.
  const industries = [...graph.nodes.reduce((m, n) => (n.facts?.industry ? m.set(n.facts.industry, (m.get(n.facts.industry) ?? 0) + 1) : m), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const draw = (n: Node, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = radius(n)
    const x = n.x ?? 0
    const y = n.y ?? 0
    const pulse = busy === n.id ? (REDUCED() ? 3 : 2 + Math.sin(Date.now() / 150) * 2) : 0
    ctx.beginPath()
    ctx.arc(x, y, r + pulse, 0, 2 * Math.PI)
    ctx.fillStyle = fill(n)
    ctx.fill()
    ctx.lineWidth = (n.id === selected ? 2.5 : expanded.has(n.id) ? 1.5 : 0.75) / Math.min(scale, 2)
    ctx.strokeStyle = n.id === selected ? ink.current.blue : ink.current.ink
    ctx.stroke()
    const img = logo(n)
    if (img) {
      const s = r * 1.1
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, s / 2 + 1, 0, 2 * Math.PI)
      ctx.clip()
      ctx.drawImage(img, x - s / 2, y - s / 2, s, s)
      ctx.restore()
    } else {
      ctx.fillStyle = ink.current.ink
      ctx.font = `600 ${r}px "Schibsted Grotesk Variable", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(n.name.charAt(0).toUpperCase(), x, y)
    }
    const fs = Math.max(11 / scale, 3)
    ctx.font = `500 ${fs}px "Schibsted Grotesk Variable", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = ink.current.ink
    ctx.fillText(n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name, x, y + r + 2)
  }

  const facts = node?.facts ? [node.facts.industry, node.facts.country, node.facts.employees && `${node.facts.employees.toLocaleString()} people`, node.facts.founded && `since ${node.facts.founded}`].filter(Boolean) : []

  return (
    <>
      {error && (
        <p className="notice notice--error" role="alert">
          <AlertCircle aria-hidden="true" /> <span>{error}</span>
        </p>
      )}
      {exhausted && (
        <p className="notice" role="status">
          <Clock aria-hidden="true" />
          <span>
            Monthly budget used up, so bubbles cannot grow. <Link href="/profile">See Profile</Link> for when it resets.
          </span>
        </p>
      )}
      <div className="bubble-map">
        <div className="bubble-map__frame">
        <div className="bubble-map__canvas" ref={box} aria-hidden="true">
          {size.width > 0 && (
            <ForceGraph2D<Bubble>
              ref={fg}
              width={size.width}
              height={size.height}
              graphData={graph}
              nodeCanvasObject={draw}
              nodePointerAreaPaint={(n, color, ctx) => {
                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(n.x ?? 0, n.y ?? 0, radius(n) + 2, 0, 2 * Math.PI)
                ctx.fill()
              }}
              nodeLabel={(n) => n.what || n.name}
              linkColor={() => ink.current.link}
              linkWidth={1}
              onNodeClick={click}
              autoPauseRedraw={!busy}
              cooldownTicks={120}
              onEngineStop={() => {
                if (!fitNext.current) return
                frame(fitNext.current)
                fitNext.current = null
              }}
            />
          )}
        </div>
        {/* Outside the aria-hidden canvas, so they stay reachable by keyboard. */}
        <div className="bubble-map__zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => zoomBy(1.5)} aria-label="Zoom in"><Plus aria-hidden="true" /></button>
          <button type="button" onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out"><Minus aria-hidden="true" /></button>
          <button type="button" onClick={() => fit()} aria-label="Fit the whole map"><Maximize aria-hidden="true" /></button>
        </div>
        {graph.nodes.length > 1 && (
          <div className="bubble-map__legend">
            {industries.length > 0 && (
              <ul aria-label="Colour shows industry">
                {industries.map(([name]) => (
                  <li key={name}><span className="bubble-map__swatch" style={{ background: `var(--bubble-${tint(name)})` }} aria-hidden="true" /> {name}</li>
                ))}
              </ul>
            )}
            <p>Size shows headcount. Scroll to move, pinch to zoom.</p>
          </div>
        )}
      </div>

        <aside className="bubble-map__panel" aria-live="polite">
          {node && (
            <div className="stop__body">
              <div className="stop__head">
                <CompanyLogo company={node.name} domain={node.domain} size={40} />
                <div className="stop__id">
                  <h2 className="stop__name">{node.name}</h2>
                  {node.domain && (
                    <a className="stop__domain" href={`https://${node.domain}`} target="_blank" rel="noopener noreferrer">
                      {node.domain} <ExternalLink aria-hidden="true" />
                    </a>
                  )}
                  {node.unverified && <span className="stop__tag">Model suggestion · verify</span>}
                </div>
              </div>
              {node.what && <p className="stop__what">{node.what}</p>}
              {node.why && (
                <p className="stop__why">
                  <span className="label">Why</span> {node.why}
                </p>
              )}
              {facts.length > 0 && (
                <p className="stop__facts">
                  <span className="tnum">{facts.join(' · ')}</span>
                  <a href={`https://www.wikidata.org/wiki/${node.facts!.qid}`} target="_blank" rel="noopener noreferrer">
                    Wikidata <ExternalLink aria-hidden="true" />
                  </a>
                </p>
              )}
              <div className="stop__actions">
                <Link href={boothHref(node)} className="btn btn--sm btn--primary" onClick={() => posthog.capture('booth_opened_from_scout', { source: 'bubble_map' })}>
                  Find people
                </Link>
                <Link href={`/jobs?${new URLSearchParams({ careers: node.name, domain: node.domain ?? '' })}`} className="btn btn--sm">
                  Open roles
                </Link>
                <button type="button" className="btn btn--sm" aria-pressed={saved.has(key(node.name))} onClick={() => toggleSave(node)}>
                  <Star aria-hidden="true" className={saved.has(key(node.name)) ? 'is-filled' : undefined} /> {saved.has(key(node.name)) ? 'Saved' : 'Save'}
                </button>
                <button type="button" className="btn btn--sm btn--quiet" onClick={() => expand(node)} disabled={!!busy || exhausted || expanded.has(node.id)} aria-busy={busy === node.id}>
                  <Network aria-hidden="true" /> {busy === node.id ? 'Growing…' : expanded.has(node.id) ? 'Grown' : 'Grow similar'}
                </button>
                {node.depth > 0 && degree(node.id) <= 1 && (
                  <button type="button" className="btn btn--sm btn--quiet btn--danger" onClick={() => remove(node)}>
                    <Trash2 aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
            </div>
          )}
          <button type="button" className="btn btn--sm" onClick={save} disabled={saving || loading || (!!savedId.current && !dirty)} aria-busy={saving}>
            <Bookmark aria-hidden="true" className={savedId.current && !dirty ? 'is-filled' : undefined} /> {saving ? 'Saving…' : !savedId.current ? 'Save map' : dirty ? 'Save changes' : 'Map saved'}
          </button>
          <p className="scout__hint tnum">
            Click a bubble to open it, and again to grow the companies like it. {graph.nodes.length} {graph.nodes.length === 1 ? 'company' : 'companies'}, found on the public web by a model; check each before you apply.
          </p>
          {/* The canvas is for pointers; this list gives keyboards and screen readers the same map. */}
          <ul className="sr-only bubble-map__keys" aria-label="Companies on the map">
            {graph.nodes.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => setSelected(n.id)} aria-current={n.id === selected ? 'true' : undefined}>
                  {n.name}
                  {expanded.has(n.id) ? ', grown' : ''}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <LogoCredit />
    </>
  )
}

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches
/** One of the six bubble tints per industry name, stable across maps. */
function tint(industry: string) {
  let h = 0
  for (const ch of industry) h = (h * 31 + ch.charCodeAt(0)) | 0
  return 1 + (Math.abs(h) % 6)
}

/** Logos load once per company and redraw when ready; null until then (or when there is none), so a monogram shows. */
const logos = new Map<string, HTMLImageElement | null>()
function logo(n: Node): HTMLImageElement | null {
  const src = logoUrl(n.name, n.domain, 48)
  if (!src) return null
  if (!logos.has(src)) {
    const img = new Image()
    logos.set(src, null)
    img.onload = () => logos.set(src, img)
    img.src = src
  }
  return logos.get(src) ?? null
}
