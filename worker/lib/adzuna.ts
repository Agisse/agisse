import { eq } from 'drizzle-orm'
import type { Listing } from '../../shared/listings'
import { fromAdzuna } from '../../shared/listings'
import { schema, type Db } from '../db'

declare global {
  interface Env {
    ADZUNA_APP_ID?: string
    ADZUNA_APP_KEY?: string
  }
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export const adzunaEnabled = (env: Env) => Boolean(env.ADZUNA_APP_ID?.trim() && env.ADZUNA_APP_KEY?.trim())

type Search = { country: string; what: string; where: string }

// ponytail: exa_cache is now a shared external-API cache. Rename it to api_cache when a third server-side source appears.
export async function searchAdzuna(env: Env, db: Db, input: Search): Promise<Listing[]> {
  if (!adzunaEnabled(env)) throw new Error('Adzuna is not configured')
  const query = { country: input.country.toLowerCase(), what: input.what.trim(), where: input.where.trim() }
  const key = `adzuna:${JSON.stringify(query)}`
  try {
    const hit = await db.query.exaCache.findFirst({ where: eq(schema.exaCache.key, key) })
    if (hit && Date.now() - hit.createdAt.getTime() < CACHE_TTL_MS) return hit.results as Listing[]
  } catch (err) {
    console.error('adzuna cache read failed', err)
  }

  const params = new URLSearchParams({ app_id: env.ADZUNA_APP_ID!, app_key: env.ADZUNA_APP_KEY!, results_per_page: '50', what: query.what, where: query.where, 'content-type': 'application/json' })
  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(query.country)}/search/1?${params}`, {
    headers: { 'user-agent': 'Agisse/1.0 (https://agisse.app)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Adzuna ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200) || res.statusText}`)
  const data = (await res.json()) as { results?: Record<string, unknown>[] }
  const results = (data.results ?? []).map(fromAdzuna).filter((x): x is Listing => !!x)
  const createdAt = new Date()
  await db
    .insert(schema.exaCache)
    .values({ key, results, createdAt })
    .onConflictDoUpdate({ target: schema.exaCache.key, set: { results, createdAt } })
    .catch((err) => console.error('adzuna cache write failed', err))
  return results
}
