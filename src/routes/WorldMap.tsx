import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from 'wouter/use-browser-location'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import type * as GeoJSON from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 finds its worker next to itself via import.meta.url, which bundling breaks; hand it Vite's bundled copy.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { JOB_STATUSES, type JobStatus, type JobSummary } from '../../shared/types'
import { LogoCredit, logoUrl } from '../components/CompanyLogo'
import { geocodable, geocode, spread, type LngLat } from '../lib/geo'

maplibregl.setWorkerUrl(workerUrl)

const SHOWN = JOB_STATUSES.filter((s) => s !== 'discarded')
const statusName = (s: JobStatus) => s[0]!.toUpperCase() + s.slice(1)
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const token = (s: JobStatus) => cssVar(`--status-${s}`)

type Pin = GeoJSON.Feature<GeoJSON.Point, { id: string; company: string; role: string; status: JobStatus; logo?: string }>

/** Zoom from which single pins show their company's logo. */
const LOGO_ZOOM = 8

/** Jobs › Tracking › Map: every posting you track, pinned where the job is. */
export function WorldMap({ jobs: all }: { jobs: JobSummary[] }) {
  // Memoised on the list, so a new array identity only comes with new postings and geocoding does not restart.
  const shown = useMemo(() => all.filter((j) => j.status !== 'discarded'), [all])
  const jobs = { data: shown }
  const [points, setPoints] = useState<Map<string, LngLat | null>>(new Map())
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  // Geocode each distinct location one at a time (Nominatim allows 1 req/s); cache makes revisits instant.
  useEffect(() => {
    if (!jobs.data) return
    const ctl = new AbortController()
    void (async () => {
      for (const loc of new Set(jobs.data!.map((j) => j.location).filter(geocodable))) {
        const p = await geocode(loc, ctl.signal).catch(() => null)
        if (ctl.signal.aborted) return
        setPoints((m) => new Map(m).set(loc, p))
      }
    })()
    return () => ctl.abort()
  }, [jobs.data])

  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current!,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [10, 50],
      zoom: 3,
      attributionControl: { compact: true },
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource('pins', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 40, clusterMaxZoom: 11 })
      m.addLayer({ id: 'clusters', type: 'circle', source: 'pins', filter: ['has', 'point_count'], paint: { 'circle-color': cssVar('--ink'), 'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 20, 24], 'circle-stroke-color': cssVar('--paper'), 'circle-stroke-width': 2 } })
      m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'pins', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': cssVar('--paper') } })
      m.addLayer({
        id: 'pin', type: 'circle', source: 'pins', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['match', ['get', 'status'], ...SHOWN.flatMap((s) => [s, token(s)]), token('evaluated')] as unknown as maplibregl.ExpressionSpecification,
          'circle-radius': ['step', ['zoom'], 8, LOGO_ZOOM, 16], 'circle-stroke-color': cssVar('--ink'), 'circle-stroke-width': 1.5,
        },
      })
      // The logo URL doubles as the image id; each loads the first time a pin needs it.
      m.addLayer({
        id: 'pin-logo', type: 'symbol', source: 'pins', minzoom: LOGO_ZOOM, filter: ['all', ['!', ['has', 'point_count']], ['has', 'logo']],
        layout: { 'icon-image': ['get', 'logo'], 'icon-allow-overlap': true },
      })
      m.on('styleimagemissing', ({ id }) => {
        if (!id.startsWith('https://')) return
        m.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) }) // placeholder, so it's asked for once
        m.loadImage(id).then(({ data }) => { if (m.hasImage(id)) m.removeImage(id); m.addImage(id, data, { pixelRatio: 2 }) }, () => {}) // no logo: the status dot shows alone
      })
      m.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
        const f = e.features![0]!
        const zoom = await (m.getSource('pins') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number)
        m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as LngLat, zoom, duration: reduced() ? 0 : 500 })
      })
      m.on('click', ['pin', 'pin-logo'], (e: MapLayerMouseEvent) => {
        const p = e.features![0]!.properties as Pin['properties']
        new maplibregl.Popup({ offset: 12, className: 'world-map__popup' })
          .setLngLat((e.features![0]!.geometry as GeoJSON.Point).coordinates as LngLat)
          .setDOMContent(popup(p))
          .addTo(m)
      })
      for (const l of ['clusters', 'pin', 'pin-logo']) {
        m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer'))
        m.on('mouseleave', l, () => (m.getCanvas().style.cursor = ''))
      }
      map.current = m
      setPoints((p) => new Map(p)) // repaint whatever geocoded before the style loaded
    })
    return () => { map.current = null; m.remove() }
  }, [])

  const pins = toPins(jobs.data ?? [], points)
  const fitted = useRef(false)
  useEffect(() => {
    const m = map.current
    if (!m) return
    ;(m.getSource('pins') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pins })
    // Frame everything once, after the last location resolves.
    const pending = new Set((jobs.data ?? []).map((j) => j.location).filter(geocodable)).size - points.size
    if (!fitted.current && pending === 0 && pins.length) {
      fitted.current = true
      const b = new maplibregl.LngLatBounds()
      for (const p of pins) b.extend(p.geometry.coordinates as LngLat)
      m.fitBounds(b, { padding: 60, maxZoom: 9, duration: reduced() ? 0 : 800 })
    }
  })

  const unplaced = (jobs.data?.length ?? 0) - pins.length
  const loading = jobs.data && new Set(jobs.data.map((j) => j.location).filter(geocodable)).size > points.size

  return (
    <div className="world-map">
      <div className="world-map__frame">
        <div ref={box} className="world-map__canvas" />
        <ul className="world-map__legend" aria-label="Status">
          {SHOWN.map((s) => (
            <li key={s}><span className="world-map__dot" aria-hidden="true" style={{ background: `var(--status-${s})` }} /> {statusName(s)}</li>
          ))}
        </ul>
        <p className="world-map__status label label--muted tnum" aria-live="polite">
          {loading ? 'Placing postings…' : `${pins.length} on the map${unplaced > 0 ? ` · ${unplaced} remote or without a place` : ''}`}
        </p>
      </div>
      <LogoCredit />
    </div>
  )
}

function toPins(jobs: JobSummary[], points: Map<string, LngLat | null>): Pin[] {
  const seen = new Map<string, number>()
  return jobs.flatMap((j) => {
    const p = j.location ? points.get(j.location) : null
    if (!p) return []
    const k = p.join()
    const i = seen.get(k) ?? 0
    seen.set(k, i + 1)
    return [{ type: 'Feature', geometry: { type: 'Point', coordinates: spread(p, i) }, properties: { id: j.id, company: j.company, role: j.role, status: j.status, logo: logoUrl(j.company, j.domain, 20) ?? undefined } }]
  })
}

/** Built from nodes, not HTML, since company and role come from pasted postings. */
function popup(p: Pin['properties']) {
  const el = document.createElement('div')
  const strong = el.appendChild(document.createElement('strong'))
  strong.textContent = p.company
  el.appendChild(document.createElement('p')).textContent = p.role
  const status = el.appendChild(document.createElement('span'))
  status.className = `status-pill status-pill--${p.status}`
  status.textContent = statusName(p.status)
  const a = el.appendChild(document.createElement('a'))
  a.href = `/jobs/${p.id}`
  a.textContent = 'Open posting'
  a.onclick = (e) => { e.preventDefault(); navigate(a.pathname) }
  return el
}
