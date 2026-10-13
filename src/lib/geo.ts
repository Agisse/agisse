/** Posting locations → map points. Nominatim (OSM, free, no key) in the browser, cached per location.
 * Nominatim over Photon: Photon ranks Brussels, Illinois above Brussels, Belgium.
 * ponytail: client-side Nominatim + localStorage at ≤1 req/s; move to a worker endpoint with the Cache API if locations pile up. */

export type LngLat = [number, number]

/** A location worth geocoding: not empty, not only "remote". */
export const geocodable = (loc: string | null | undefined): loc is string =>
  !!loc && !/^\s*(fully\s+)?remote\s*$/i.test(loc) && loc.trim().length > 1

/** Nominatim's answer (`[{ lon: "4.35", lat: "50.84" }]`) → the first point, or null. */
export function parseGeo(body: unknown): LngLat | null {
  const hit = Array.isArray(body) ? (body[0] as { lon?: unknown; lat?: unknown } | undefined) : undefined
  const lng = Number(hit?.lon), lat = Number(hit?.lat)
  return hit && Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
}

const cacheKey = (loc: string) => `geo:${loc.trim().toLowerCase()}`

/** Cached point, `null` for a known miss, `undefined` when never asked. */
function cached(loc: string): LngLat | null | undefined {
  try {
    const v = localStorage.getItem(cacheKey(loc))
    return v === null ? undefined : (JSON.parse(v) as LngLat | null)
  } catch {
    return undefined
  }
}

let last = 0

export async function geocode(loc: string, signal?: AbortSignal): Promise<LngLat | null> {
  const hit = cached(loc)
  if (hit !== undefined) return hit
  // "Brussels (hybrid)" geocodes better as "Brussels"; "Ghent / Remote" as "Ghent".
  const q = loc.replace(/\(.*?\)/g, '').split(/\s[/|·]\s|;/)[0]!.trim()
  // Nominatim's usage policy: at most one request a second.
  await new Promise((r) => setTimeout(r, Math.max(0, last + 1100 - Date.now())))
  last = Date.now()
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { signal })
  if (!res.ok) return null // transient: don't cache, try again next visit
  const point = parseGeo(await res.json())
  try {
    localStorage.setItem(cacheKey(loc), JSON.stringify(point))
  } catch {}
  return point
}

/** Nudge the n-th posting at the same spot onto a small ring, so pins in one city don't stack. */
export function spread([lng, lat]: LngLat, i: number): LngLat {
  if (i === 0) return [lng, lat]
  const a = i * 2.4 // golden angle
  const r = 0.01 * Math.sqrt(i)
  return [lng + r * Math.cos(a), lat + r * Math.sin(a)]
}
