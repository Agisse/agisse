// Reference feed provider: loads Arbeitnow's free public API into `vacancy`, following docs/feed-contract.md.
//   npx tsx --env-file=.env scripts/import-feed.ts           (upserts into DATABASE_URL)
//   npx tsx scripts/import-feed.ts --dry                      (downloads and maps only)
// Only early-career roles are kept. Run it at least daily: a role drops out of the feed 3 days after its last import.
import { pathToFileURL } from 'node:url'
import { eq, sql } from 'drizzle-orm'
import { createDb, schema } from '../worker/db'
import { VACANCY_COUNTRIES, htmlToText, levelOf, type VacancyFunction } from '../shared/listings'

type Row = Record<string, unknown>
type Level = 'internship' | 'entry'

const API = 'https://www.arbeitnow.com/api/job-board-api'
// ponytail: the API asks not to be abused; 5 pages of 300 covers its last few days.
const MAX_PAGES = 5

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Location words to a country. Arbeitnow's location is free text ("Remote Switzerland", "London, England, United Kingdom").
const PLACES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(VACANCY_COUNTRIES).filter(([c]) => c !== 'EU').map(([c, name]) => [fold(name), c])),
  europe: 'EU', deutschland: 'DE', schweiz: 'CH', suisse: 'CH', svizzera: 'CH', osterreich: 'AT', nederland: 'NL', belgie: 'BE',
  belgique: 'BE', espana: 'ES', italia: 'IT', polska: 'PL', england: 'GB', scotland: 'GB', wales: 'GB', uk: 'GB',
  amsterdam: 'NL', rotterdam: 'NL', utrecht: 'NL', eindhoven: 'NL', 'the hague': 'NL', 'den haag': 'NL', paris: 'FR', lyon: 'FR',
  lille: 'FR', london: 'GB', manchester: 'GB', bristol: 'GB', edinburgh: 'GB', berlin: 'DE', munich: 'DE', munchen: 'DE',
  hamburg: 'DE', frankfurt: 'DE', cologne: 'DE', koln: 'DE', dusseldorf: 'DE', stuttgart: 'DE', leipzig: 'DE', zurich: 'CH',
  geneva: 'CH', geneve: 'CH', bern: 'CH', basel: 'CH', lausanne: 'CH', vienna: 'AT', wien: 'AT', brussels: 'BE', bruxelles: 'BE',
  antwerp: 'BE', ghent: 'BE', dublin: 'IE', madrid: 'ES', barcelona: 'ES', milan: 'IT', milano: 'IT', rome: 'IT', lisbon: 'PT',
  warsaw: 'PL', krakow: 'PL', prague: 'CZ', stockholm: 'SE', copenhagen: 'DK', helsinki: 'FI', oslo: 'NO',
}

/** The one country a location names, or null when it names none or several. Never guessed. */
export function countryOf(location: string): string | null {
  const text = ` ${fold(location).replace(/[^\p{L}\p{N}]+/gu, ' ')} `
  const found = new Set(Object.entries(PLACES).filter(([place]) => text.includes(` ${place} `)).map(([, c]) => c))
  if (found.size > 1) found.delete('EU')
  return found.size === 1 ? [...found][0]! : null
}

// Arbeitnow tags that name a field unambiguously. "Engineering" isn't one: it's software as often as civil.
const TAG_FUNCTIONS: Record<string, VacancyFunction> = {
  sales: 'sales', 'business development': 'sales', marketing: 'marketing', product: 'product', 'product management': 'product',
  software: 'software', 'software development': 'software', frontend: 'software', backend: 'software', it: 'software',
  'data science': 'data', 'data analytics': 'data', legal: 'legal', hr: 'hr', 'human resources': 'hr', 'talent acquisition': 'hr',
  design: 'design', 'ux/ui': 'design', operations: 'ops', logistics: 'ops', 'supply chain': 'ops', 'logistics and supply chain': 'ops',
}

const JOB_TYPE_LEVELS: Record<string, Level> = {
  intern: 'internship', internship: 'internship', student: 'internship', 'working student': 'internship', werkstudent: 'internship',
  praktikum: 'internship', entry: 'entry', junior: 'entry', graduate: 'entry', apprenticeship: 'entry',
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const day = (d: Date) => d.toISOString().slice(0, 10)

/** One Arbeitnow row as a `vacancy` row, or null when it isn't an early-career role or lacks a required field. */
export function vacancyFromArbeitnow(row: Row, today: string): typeof schema.vacancy.$inferInsert | null {
  const str = (k: string) => (typeof row[k] === 'string' ? (row[k] as string).trim() : '')
  const url = str('url')
  const title = str('title')
  const company = str('company_name')
  if (!url.startsWith('https://') || !title || !company) return null
  // The title wins over the job types: "Senior Analyst" tagged "Entry" is not entry level.
  const fromTitle = levelOf(title)
  if (fromTitle === 'experienced') return null
  const level = fromTitle ?? strings(row.job_types).map((t) => JOB_TYPE_LEVELS[t.toLowerCase()]).find(Boolean)
  if (!level) return null
  const created = typeof row.created_at === 'number' ? new Date(row.created_at * 1000) : null
  const posted = created && !Number.isNaN(created.getTime()) ? day(created) : null
  const location = str('location')
  return {
    url,
    source: 'arbeitnow',
    company,
    title,
    location: location || null,
    country: countryOf(location),
    remote: row.remote === true,
    description: htmlToText(str('description')) || null,
    postedAt: posted,
    firstSeen: posted && posted < today ? posted : today,
    lastSeen: today,
    level,
    functions: [...new Set(strings(row.tags).map((t) => TAG_FUNCTIONS[t.toLowerCase()]).filter((f) => !!f))],
  }
}

async function main() {
  const dry = process.argv.includes('--dry')
  const today = day(new Date())
  const rows: NonNullable<ReturnType<typeof vacancyFromArbeitnow>>[] = []
  let next: string | null = API
  let seen = 0
  for (let page = 0; next && page < MAX_PAGES; page++) {
    if (page) await new Promise((r) => setTimeout(r, 3000))
    const res = await fetch(next)
    if (!res.ok && page) {
      console.warn(`Arbeitnow ${res.status} on page ${page + 1}; importing the pages so far`)
      break
    }
    if (!res.ok) throw new Error(`Arbeitnow ${res.status}`)
    const body = (await res.json()) as { data?: Row[]; links?: { next?: string | null } }
    seen += body.data?.length ?? 0
    for (const r of body.data ?? []) {
      const v = vacancyFromArbeitnow(r, today)
      if (v) rows.push(v)
    }
    next = body.links?.next ?? null
  }
  console.log(`${seen} Arbeitnow roles, ${rows.length} early-career, e.g.`, rows.slice(0, 3).map((r) => `${r.title} (${r.country ?? '?'})`).join(' | '))
  if (dry || !rows.length) return

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set (use --env-file=.env)')
  const db = createDb(url)
  const v = schema.vacancy
  // Refreshes only rows this script wrote; another provider's row for the same URL is left alone.
  await db
    .insert(v)
    .values(rows)
    .onConflictDoUpdate({
      target: v.url,
      set: { title: sql`excluded.title`, description: sql`excluded.description`, location: sql`excluded.location`, country: sql`excluded.country`, remote: sql`excluded.remote`, level: sql`excluded.level`, functions: sql`excluded.functions`, lastSeen: sql`excluded.last_seen`, closedAt: null },
      setWhere: eq(v.source, 'arbeitnow'),
    })
  console.log('imported')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
