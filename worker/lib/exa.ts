// Exa people search: the only discovery source. Public index, no LinkedIn access from our side.
import { eq, lt } from 'drizzle-orm'
import { schema, type Db } from '../db'
import type { Meter } from './openrouter'

declare global {
  interface Env {
    /** Unset turns people search off with a clear message; the rest of the app works. */
    EXA_API_KEY?: string
  }
}

// Exa refreshes its people index weekly, so a week-old answer is as good as a fresh one.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Owner decision (#148): rows past the TTL are never served again, so the daily cron deletes them.
export const pruneExaCache = (db: Db) => db.delete(schema.exaCache).where(lt(schema.exaCache.createdAt, new Date(Date.now() - CACHE_TTL_MS)))

export type ExaPerson = {
  id: string
  title: string // person's name
  url: string // public profile URL (usually LinkedIn)
  text: string // Exa's indexed profile text: headline, experience, education
  image?: string
}

type ExaResponse = {
  results: Array<{ id: string; title: string; url: string; text?: string; image?: string }>
  costDollars?: { total: number }
}

// One canonical form per profile, so the same person found by two queries (or stored before this existed) compares equal.
// LinkedIn: https://www.linkedin.com/in/<lowercase-slug>. Anything else: lowercase host, no query/hash/trailing slash.
export function normalizeProfileUrl(url: string): string {
  const raw = url.trim()
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const host = u.hostname.toLowerCase()
    let path = u.pathname.replace(/\/+$/, '')
    try {
      path = decodeURIComponent(path)
    } catch {
      // Malformed escape: keep the path as-is.
    }
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return `https://www.linkedin.com${path.toLowerCase()}`
    return `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}${path}`
  } catch {
    return raw
  }
}

/** Serves a stored answer younger than the TTL, else fetches and stores it. A hit costs nothing: the meter is only charged inside `fetcher`. */
async function cached<T>(db: Db | undefined, key: string, fetcher: () => Promise<T>): Promise<T> {
  if (db) {
    try {
      const hit = await db.query.exaCache.findFirst({ where: eq(schema.exaCache.key, key) })
      if (hit && Date.now() - hit.createdAt.getTime() < CACHE_TTL_MS) return hit.results as T
    } catch (err) {
      console.error('exa cache read failed', err)
    }
  }
  const results = await fetcher()
  if (db) {
    const createdAt = new Date()
    await db
      .insert(schema.exaCache)
      .values({ key, results, createdAt })
      .onConflictDoUpdate({ target: schema.exaCache.key, set: { results, createdAt } })
      .catch((err) => console.error('exa cache write failed', err))
  }
  return results
}

async function exaPost<T>(apiKey: string | undefined, path: 'search' | 'contents', body: unknown): Promise<T & { costDollars?: { total: number } }> {
  if (!apiKey) throw new Error('People search is off on this server: set EXA_API_KEY to turn it on.')
  const res = await fetch(`https://api.exa.ai/${path}`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Exa ${res.status}: ${text.slice(0, 200) || res.statusText}`)
  }
  return res.json()
}

export async function exaPeopleSearch(apiKey: string | undefined, query: string, numResults = 12, meter?: Meter, db?: Db): Promise<ExaPerson[]> {
  const body = { query, category: 'people', type: 'auto', numResults, contents: { text: { maxCharacters: 2000 } } }
  const results = await cached(db, `people:${JSON.stringify(body)}`, async () => {
    const data = await exaPost<ExaResponse>(apiKey, 'search', body)
    if (meter) meter.costUsd += data.costDollars?.total ?? 0
    return data.results.filter((r) => r.title && r.url).map((r) => ({ id: r.id, title: r.title, url: normalizeProfileUrl(r.url), text: r.text ?? '', image: r.image }))
  })
  // Rows stored before URLs were normalized compare equal too.
  return results.map((r) => ({ ...r, url: normalizeProfileUrl(r.url) }))
}

export type WebResult = { url: string; title: string; text: string; publishedDate: string | null }

// Plain web search (no people category): recruitment pages, provider docs, candidate reports.
export async function searchWeb(env: Env, query: string, meter?: Meter, numResults = 6, includeDomains?: string[], db?: Db): Promise<WebResult[]> {
  const body = { query, type: 'auto', numResults, ...(includeDomains ? { includeDomains } : {}), contents: { text: { maxCharacters: 2500 } } }
  return cached(db, `web:${JSON.stringify(body)}`, async () => {
    const data = await exaPost<{ results: Array<{ url: string; title?: string | null; text?: string; publishedDate?: string | null }> }>(env.EXA_API_KEY, 'search', body)
    if (meter) meter.costUsd += data.costDollars?.total ?? 0
    return data.results.filter((r) => r.url).map((r) => ({ url: r.url, title: r.title ?? r.url, text: r.text ?? '', publishedDate: r.publishedDate ?? null }))
  })
}

// One public page's indexed text (a posting, or the user's own LinkedIn page). Empty string when Exa has nothing for it.
export async function fetchProfileText(env: Env, url: string, meter?: Meter, db?: Db): Promise<string> {
  const body = { urls: [url], text: { maxCharacters: 8000 } }
  return cached(db, `contents:${JSON.stringify(body)}`, async () => {
    const data = await exaPost<{ results: Array<{ title?: string; text?: string }> }>(env.EXA_API_KEY, 'contents', body)
    if (meter) meter.costUsd += data.costDollars?.total ?? 0
    const r = data.results[0]
    return r?.text ? `${r.title ?? ''}\n${r.text}`.trim() : ''
  })
}

export type CompanyResult = { url: string; title: string; text: string }

// Exa's company index: homepages and company profiles for a natural-language query ("companies like Adyen").
export async function searchCompanies(env: Env, query: string, meter?: Meter, numResults = 10, db?: Db): Promise<CompanyResult[]> {
  const body = { query, category: 'company', type: 'auto', numResults, contents: { text: { maxCharacters: 1200 } } }
  return cached(db, `company:${JSON.stringify(body)}`, async () => {
    const data = await exaPost<{ results: Array<{ url: string; title?: string | null; text?: string }> }>(env.EXA_API_KEY, 'search', body)
    if (meter) meter.costUsd += data.costDollars?.total ?? 0
    return data.results.filter((r) => r.url).map((r) => ({ url: r.url, title: r.title ?? r.url, text: r.text ?? '' }))
  })
}
