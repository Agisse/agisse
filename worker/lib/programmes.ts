import { and, asc, desc, eq, gte, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../db'
import { schema } from '../db'
import { plainText } from '../../shared/listings'
import { EUROPE, nextKinds, type Programme, type ProgrammeFacets } from '../../shared/programmes'
import { degreeQuery, PAGE } from './vacancies'

export type ProgrammeQuery = {
  q: string
  kinds: string[]
  countries: string[]
  fields: string[]
  /** Taught in any of these. */
  languages: string[]
  /** Per year, in €; programmes without a known fee are left out. */
  maxTuition: number | null
  /** Only programmes with a stated deadline in the next N days, soonest first. */
  deadlineWithin: number | null
  /** Only the seeker's saved programmes. */
  saved: boolean
  offset: number
}

const p = schema.programme
const sp = schema.savedProgramme
const textArray = (xs: string[]) => sql`ARRAY[${sql.join(xs.map((x) => sql`${x}`), sql`, `)}]::text[]`

/** Still open: not closed by the provider, deadline not passed. */
const open = () => and(isNull(p.closedAt), or(isNull(p.deadline), gte(p.deadline, sql`current_date`)))

/** The filters as SQL. An empty list means no filter on that dimension. */
export function programmeFilters(f: ProgrammeQuery, userId: string): SQL[] {
  // Saved programmes stay in the seeker's list after they close, marked closed.
  const out: SQL[] = f.saved ? [] : [open()!]
  if (f.kinds.length) out.push(sql`${p.kind} = ANY(${textArray(f.kinds)})`)
  if (f.countries.length) out.push(sql`${p.country} = ANY(${textArray(f.countries)})`)
  if (f.fields.length) out.push(sql`${p.fields} && ${textArray(f.fields)}`)
  if (f.languages.length) out.push(sql`${p.languages} && ${textArray(f.languages)}`)
  if (f.maxTuition != null) out.push(lte(p.tuitionEur, f.maxTuition))
  if (f.deadlineWithin) out.push(lte(p.deadline, sql`current_date + ${f.deadlineWithin}::int`))
  if (f.saved) out.push(sql`exists (select 1 from saved_programme s where s.url = ${p.url} and s.user_id = ${userId})`)
  if (f.q.trim()) out.push(sql`${p.search} @@ websearch_to_tsquery('simple', ${f.q.trim()})`)
  return out
}

const rankOf = (r: { rankThe: number | null; rankQs: number | null; rankFt: number | null }): Programme['rank'] =>
  ([['THE', r.rankThe], ['QS', r.rankQs], ['FT', r.rankFt]] as const)
    .filter((x): x is ['THE' | 'QS' | 'FT', number] => x[1] != null)
    .sort((a, b) => a[1] - b[1])
    .map(([by, n]) => ({ by, n }))[0] ?? null

const columns = {
  url: p.url, kind: p.kind, title: p.title, degree: p.degree, institution: p.institution, school: p.school, domain: p.domain,
  country: p.country, city: p.city, fields: p.fields, languages: p.languages, durationMonths: p.durationMonths, tuitionEur: p.tuitionEur,
  studyMode: p.studyMode, startDate: p.startDate, deadline: p.deadline, deadlineType: p.deadlineType, closedAt: p.closedAt, rankThe: p.rankThe, rankQs: p.rankQs, rankFt: p.rankFt,
}
type Row = { [K in keyof typeof columns]: (typeof columns)[K]['_']['data'] | null } & { saved: boolean }
const toProgramme = ({ rankThe, rankQs, rankFt, ...r }: Row): Programme => ({
  ...(r as Omit<Programme, 'rank'>),
  title: plainText(r.title!),
  rank: rankOf({ rankThe, rankQs, rankFt }),
})

/**
 * One page of open programmes, ranked for the seeker like the job feed, with no model call:
 * 50% their degree's field words in the programme's text, 15% a picked field, 15% the institution's best ranking
 * (top 500 stretched to 0–1), 10% the next step after their degree (a master's after a bachelor's, a PhD after a master's),
 * 10% a deadline within a month. With "closing soon" on, soonest deadline first. Europe's programmes come before the rest either way.
 */
export async function searchProgrammes(db: Db, userId: string, f: ProgrammeQuery, degree = ''): Promise<{ programmes: Programme[]; more: boolean; total: number }> {
  const tsq = degreeQuery(degree)
  const fit = tsq ? sql`coalesce(ts_rank_cd(${p.search}, to_tsquery('simple', ${tsq}), 32), 0)` : sql`0`
  const field = f.fields.length ? sql`(${p.fields} && ${textArray(f.fields)})::int` : sql`0`
  const best = sql`least(${p.rankThe}, ${p.rankQs}, ${p.rankFt})`
  const prestige = sql`coalesce(greatest(0, 1 - ${best} / 500.0), 0)`
  const next = nextKinds(degree)
  const step = next.length ? sql`(${p.kind} = ANY(${textArray(next)}))::int` : sql`0`
  const soon = sql`coalesce((${p.deadline} <= current_date + 30)::int, 0)`
  const score = sql`(0.5 * ${fit} + 0.15 * ${field} + 0.15 * ${prestige} + 0.1 * ${step} + 0.1 * ${soon})`
  const europe = sql`coalesce(${p.country} = ANY(${textArray(EUROPE)}), false)`
  const order = f.deadlineWithin ? [desc(europe), asc(p.deadline), desc(score)] : [desc(europe), desc(score), desc(p.firstSeen)]
  const where = and(...programmeFilters(f, userId))
  const [rows, [count]] = await Promise.all([
    db
      .select({ ...columns, saved: sql<boolean>`${sp.url} is not null` })
      .from(p)
      .leftJoin(sp, and(eq(sp.userId, userId), eq(sp.url, p.url)))
      .where(where)
      .orderBy(...order, asc(p.url))
      .limit(PAGE + 1)
      .offset(f.offset),
    db.select({ n: sql<number>`count(*)::int` }).from(p).where(where),
  ])
  return { programmes: rows.slice(0, PAGE).map((r) => toProgramme(r as Row)), more: rows.length > PAGE, total: count?.n ?? 0 }
}

/** One programme with its description and extras, open or not; null when the provider never wrote it or pruned it. */
export async function getProgramme(db: Db, userId: string, url: string): Promise<Programme | null> {
  const [row] = await db
    .select({ ...columns, description: p.description, details: p.details, saved: sql<boolean>`${sp.url} is not null` })
    .from(p)
    .leftJoin(sp, and(eq(sp.userId, userId), eq(sp.url, p.url)))
    .where(eq(p.url, url))
    .limit(1)
  if (!row) return null
  return { ...toProgramme(row as Row), description: row.description && plainText(row.description), details: row.details }
}

/** Saves or unsaves one programme; false when it doesn't exist. */
export async function saveProgramme(db: Db, userId: string, url: string, saved: boolean): Promise<boolean> {
  if (!saved) {
    await db.delete(sp).where(and(eq(sp.userId, userId), eq(sp.url, url)))
    return true
  }
  const rows = await db.insert(sp).select(db.select({ userId: sql`${userId}`.as('user_id'), url: p.url, createdAt: sql`now()`.as('created_at') }).from(p).where(eq(p.url, url))).onConflictDoNothing().returning({ url: sp.url })
  if (rows.length) return true
  // Already saved: the insert did nothing, but the programme exists.
  const [hit] = await db.select({ url: p.url }).from(p).where(eq(p.url, url)).limit(1)
  return !!hit
}

/** Open-programme counts per kind, country, field and teaching language, for the filter menus. The same for everyone. */
export async function programmeFacets(db: Db): Promise<ProgrammeFacets> {
  const count = sql<number>`count(*)::int`
  const [kinds, countries, fields, languages] = await Promise.all([
    db.select({ k: p.kind, n: count }).from(p).where(open()).groupBy(p.kind),
    db.select({ k: p.country, n: count }).from(p).where(open()).groupBy(p.country),
    db.select({ k: sql<string>`unnest(${p.fields})`, n: count }).from(p).where(open()).groupBy(sql`1`),
    db.select({ k: sql<string>`unnest(${p.languages})`, n: count }).from(p).where(open()).groupBy(sql`1`),
  ])
  const map = (rows: { k: string | null; n: number }[]) => Object.fromEntries(rows.filter((r) => r.k).map((r) => [r.k!, Number(r.n)]))
  return { total: kinds.reduce((a, r) => a + Number(r.n), 0), kinds: map(kinds), countries: map(countries), fields: map(fields), languages: map(languages) }
}
