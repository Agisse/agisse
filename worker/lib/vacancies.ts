import { and, asc, desc, gte, isNull, lte, or, sql, eq, type SQL } from 'drizzle-orm'
import type { Db } from '../db'
import type { Meter } from './openrouter'
import { jevDecide, scoreOf, type ScoreQ } from './jev'
import { FAIRNESS } from './pipeline'
import { schema } from '../db'
import { plainText, VACANCY_FUNCTIONS, type Vacancy, type VacancyFacets, type VacancySort } from '../../shared/listings'
import { SPONSOR_DROP, type SponsorCountry } from '../../shared/sponsors'

export type VacancyQuery = {
  q: string
  countries: string[]
  level: 'any' | 'internship' | 'entry' | 'experienced'
  functions: string[]
  industries: string[]
  languages: string[]
  remoteOnly: boolean
  /** Only roles with a stated deadline in the next N days. */
  deadlineWithin: number | null
  sort: VacancySort
  /** Roles like this one: a vacancy url (its embedding), else the title's words. Overrides the sort. */
  similar?: { url: string; title: string } | null
  offset: number
  /** Employers the seeker hid (from the profile, not the query string). */
  blocked?: string[]
  /** Only employers on a public visa-sponsor register. */
  sponsorsOnly?: boolean
  /** Programme types (PROGRAM_LABEL keys). */
  programs?: string[]
  /** Only roles first seen in the last N days. */
  newWithin?: number | null
}

export const PAGE = 30
// The hosted feed is for people, not for copying (hard rule 10 in the maintainer brief).
// Every filter change, typed search and "Show more" is one page, so a long day of looking is a few dozen; 200 pages is
// 6,000 roles a day at most, and a list goes no deeper than 20 pages. The daily cap is FEED_DAILY_PAGES in wrangler.jsonc,
// a live switch in /admin ("0" = no cap).
export const MAX_OFFSET = 600
export const FEED_DAILY_PAGES = 200
export const feedDailyPages = (env: { FEED_DAILY_PAGES?: string }) => {
  const n = Number(env.FEED_DAILY_PAGES ?? FEED_DAILY_PAGES)
  return Number.isFinite(n) && n >= 0 ? n : FEED_DAILY_PAGES
}
export const FEED_CAP_MESSAGE = "That's a lot of roles for one day. The feed opens again tomorrow."

/** Per account, the days in the last 30 on which it asked for more than the cap (a count only, for /admin). */
export async function feedCapDays(db: Db, cap: number) {
  if (!cap) return new Map<string, number>()
  const f = schema.feedDay
  const rows = await db
    .select({ userId: f.userId, days: sql<number>`count(*)::int` })
    .from(f)
    .where(and(sql`${f.pages} > ${cap}`, sql`${f.day} > current_date - 30`))
    .groupBy(f.userId)
  return new Map(rows.map((r) => [r.userId, r.days]))
}

/** Counts one feed page for today; false once the account is past today's cap. */
export async function countFeedPage(db: Db, userId: string, cap: number) {
  const [row] = await db
    .insert(schema.feedDay)
    .values({ userId, day: sql`current_date`, pages: 1 })
    .onConflictDoUpdate({ target: [schema.feedDay.userId, schema.feedDay.day], set: { pages: sql`${schema.feedDay.pages} + 1` } })
    .returning({ pages: schema.feedDay.pages })
  return !cap || row!.pages <= cap
}

/** Daily counts are kept 30 days, for the admin's "hit the feed limit" line; run by the daily cron. */
export const pruneFeedDays = (db: Db) => db.delete(schema.feedDay).where(sql`${schema.feedDay.day} < current_date - 30`)
const v = schema.vacancy
const textArray = (xs: string[]) => sql`ARRAY[${sql.join(xs.map((x) => sql`${x}`), sql`, `)}]::text[]`

/** sponsorKey (shared/sponsors.ts) in SQL: lower case, dots removed, other symbols split words, legal forms dropped. */
export const sponsorKeySql = (company: SQL | typeof v.company) =>
  sql`array_to_string(array(select t from unnest(string_to_array(trim(regexp_replace(replace(lower(${company}), '.', ''), '[^a-z0-9]+', ' ', 'g')), ' ')) with ordinality as x(t, i) where t <> '' and t <> all(${textArray(SPONSOR_DROP)}) order by i), '')`
/** The registers (NL, GB) that list this vacancy's employer, or null. */
const sponsorsOf = sql<SponsorCountry[] | null>`(select array_agg(s.country order by s.country) from sponsor s where s.key = ${sponsorKeySql(v.company)})`

/** Still open: listed in the last 3 days, not closed, deadline not passed. */
const open = () => and(isNull(v.closedAt), gte(v.lastSeen, sql`current_date - 3`), or(isNull(v.deadline), gte(v.deadline, sql`current_date`)))

/** How many roles are open right now, at how many companies, in how many countries ('EU' marks a Europe-wide posting, not a country). */
export async function openVacancyStats(db: Db): Promise<{ open: number; companies: number; countries: number }> {
  const [r] = await db
    .select({
      open: sql<number>`count(*)::int`,
      companies: sql<number>`count(distinct ${v.company})::int`,
      countries: sql<number>`(count(distinct ${v.country}) filter (where ${v.country} <> 'EU'))::int`,
    })
    .from(v)
    .where(open())
  return r!
}

/** The dealbreakers as SQL. An empty list means no filter on that dimension. */
export function vacancyFilters(f: VacancyQuery): SQL[] {
  const out: SQL[] = [open()!]
  // Everything scraped is early-career, so "experienced" has nothing to show.
  if (f.level === 'experienced') out.push(sql`false`)
  else if (f.level !== 'any') out.push(eq(v.level, f.level))
  // A remote-in-Europe role fits any country choice.
  if (f.countries.length) out.push(or(sql`${v.country} = ANY(${textArray(f.countries)})`, eq(v.country, 'EU'))!)
  if (f.functions.length) out.push(sql`${v.functions} && ${textArray(f.functions)}`)
  if (f.industries.length) out.push(sql`${v.industry} = ANY(${textArray(f.industries)})`)
  if (f.programs?.length) out.push(sql`${v.program} = ANY(${textArray(f.programs)})`)
  // Hide postings that ask for a language the seeker doesn't speak.
  if (f.languages.length) out.push(sql`${v.langsRequired} <@ ${textArray(f.languages)}`)
  if (f.remoteOnly) out.push(eq(v.remote, true))
  if (f.sponsorsOnly) out.push(sql`exists (select 1 from sponsor s where s.key = ${sponsorKeySql(v.company)})`)
  if (f.blocked?.length) out.push(sql`lower(${v.company}) <> ALL(${textArray(f.blocked.map((b) => b.toLowerCase()))})`)
  if (f.deadlineWithin) out.push(lte(v.deadline, sql`current_date + ${f.deadlineWithin}::int`))
  if (f.newWithin) out.push(gte(v.firstSeen, sql`current_date - ${f.newWithin}::int`))
  if (f.q.trim()) out.push(sql`${v.search} @@ websearch_to_tsquery('simple', ${f.q.trim()})`)
  return out
}

/**
 * The seeker's feed, one page. Match = 60% profile fit (Jev's score from vacancy_fit, else e5 cosine of
 * profile_embedding and the posting stretched from its usual 0.72–0.92 band to 0–1, else a text match of the
 * seeker's degree), 15% chosen function, 15% freshness, 10% deadline within two weeks.
 * No model call per view: the feed provider writes the embeddings and scores.
 */
export async function searchVacancies(db: Db, userId: string, f: VacancyQuery, skills: string[], degree = ''): Promise<{ vacancies: Vacancy[]; more: boolean; profiled: boolean; total: number }> {
  const pe = sql`(select embedding from profile_embedding where user_id = ${userId})`
  // Jev's judgement where the feed provider scored the pair (the seeker's top cosine matches), else the stretched cosine.
  // A join, not a per-row subquery: the subquery ran once per open role for every place `fit` appears.
  const vf = schema.vacancyFit
  const jev = vf.score
  // Cold start (no embedding yet): the degree's words against the posting's text, rank/(rank+1) so it stays in 0–1.
  // Target industries ("Tech", "Research") are left out: they match employer names and pulled the feed off-field (npm run eval:feed).
  // Ranked only for the roles the words match (the search index finds those), not every open role. No words: no hits.
  const tsq = sql`to_tsquery('simple', ${degreeQuery(degree)})`
  const hits = db.select({ url: v.url, rank: sql<number>`ts_rank_cd(${v.search}, ${tsq}, 32)`.as('rank') }).from(v).where(and(sql`${v.search} @@ ${tsq}`, ...vacancyFilters(f))).as('degree_hits')
  const text = sql`coalesce(${hits.rank}, 0)`
  // greatest/least skip nulls, so the cosine needs its own guard or a missing embedding reads as a perfect fit.
  const cosine = sql`case when ${v.embedding} is not null and ${pe} is not null then greatest(0, least(1, ((1 - (${v.embedding} <=> ${pe})) - 0.72) / 0.2)) end`
  const fit = sql<number>`coalesce(${jev}, ${cosine}, ${text})`
  const fn = f.functions.length ? sql`(${v.functions} && ${textArray(f.functions)})::int` : sql`0`
  const fresh = sql`greatest(0, 1 - (current_date - ${v.firstSeen}) / 30.0)`
  const soon = sql`coalesce((${v.deadline} <= current_date + 14)::int, 0)`
  const score = sql<number>`round(100 * (0.6 * ${fit} + 0.15 * ${fn} + 0.15 * ${fresh} + 0.1 * ${soon}))::int`
  // With several fields picked, best match takes turns between them, so 8 banking roles are not buried under 364 in finance.
  // Each role counts for the first picked field it has.
  const field = sql`(select min(array_position(${textArray(f.functions)}, x)) from unnest(${v.functions}) x)`
  const turns = f.functions.length > 1 ? [sql`row_number() over (partition by ${field} order by ${score} desc, ${v.url})`] : []
  let order = f.sort === 'new' ? [desc(v.firstSeen), desc(score)] : f.sort === 'deadline' ? [sql`${v.deadline} asc nulls last`, desc(score)] : [...turns, desc(score), desc(v.firstSeen)]
  const where = vacancyFilters(f)
  if (f.similar) {
    const like = await similarTo(db, f.similar)
    where.push(...like.where)
    order = [like.order, desc(score)]
  }
  const [rows, [count], [profiled]] = await Promise.all([
    db
      .select({
        url: v.url, title: v.title, company: v.company, domain: v.domain, location: v.location, country: v.country, city: v.city,
        remote: v.remote, level: v.level, program: v.program, functions: v.functions, industry: v.industry, deadline: v.deadline,
        deadlineType: v.deadlineType, firstSeen: v.firstSeen, lastSeen: v.lastSeen, description: v.description, fit, jev: sql<number | null>`${jev}`, score, sponsors: sponsorsOf,
      })
      .from(v)
      .leftJoin(vf, and(eq(vf.userId, userId), eq(vf.url, v.url)))
      .leftJoin(hits, eq(hits.url, v.url))
      .where(and(...where))
      .orderBy(...order, asc(v.url))
      .limit(PAGE + 1)
      .offset(f.offset),
    // Its own query: `count(*) over ()` held every matching row, description included, until the sort, and spilled to disk.
    db.select({ n: sql<number>`count(*)::int` }).from(v).where(and(...where)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.profileEmbedding).where(eq(schema.profileEmbedding.userId, userId)),
  ])
  const vacancies = rows.slice(0, PAGE).map(({ fit, jev, ...r }) => ({
    ...r,
    title: plainText(r.title),
    description: r.description && plainText(r.description),
    level: r.level as Vacancy['level'],
    deadlineType: r.deadlineType as Vacancy['deadlineType'],
    sponsors: r.sponsors ?? [],
    reasons: reasonsFor({ ...r, fit: Number(fit), jev: jev == null ? null : Number(jev) }, f.functions, skills),
  }))
  return { vacancies, more: rows.length > PAGE && f.offset + PAGE <= MAX_OFFSET, profiled: (profiled?.n ?? 0) > 0, total: count?.n ?? 0 }
}

/** Title words worth matching on: no short words, numbers or generic programme words. */
export const titleWords = (title: string) =>
  [...new Set(title.toLowerCase().split(/[^\p{L}\p{N}&]+/u).filter((w) => w.length > 2 && !/^\d+$/.test(w) && !SIMILAR_STOP.has(w)))].slice(0, 8)
// Words every graduate title shares; matching on them alone finds everything.
const SIMILAR_STOP = new Set(['the', 'and', 'for', 'with', 'm/f/d', 'f/m/d', 'w/m/d', 'h/f', 'all', 'genders', 'gn', 'job', 'jobs', 'position', 'role', 'team', 'new', 'our',
  'program', 'programme', 'programm', 'internship', 'intern', 'interns', 'summer', 'winter', 'spring', 'autumn', 'graduate', 'graduates', 'trainee', 'traineeship', 'junior', 'entry', 'level', 'student', 'students', 'working',
  'london', 'paris', 'brussels', 'amsterdam', 'berlin', 'munich', 'frankfurt', 'madrid', 'milan', 'dublin', 'zurich', 'luxembourg', 'europe', 'emea', 'remote', 'hybrid'])

// Degree words that say nothing about the field ("MSc", "Sciences", "Bachelor of Arts").
const DEGREE_STOP = new Set(['bsc', 'msc', 'llb', 'llm', 'mba', 'phd', 'beng', 'meng', 'march', 'mphil', 'bachelor', 'bachelors', 'master', 'masters', 'degree', 'science', 'sciences', 'arts', 'studies', 'hons', 'honours'])

/** The degree's field words as an OR for to_tsquery('simple', …), or null when none are left. No stemming there, so longer words match as prefixes ("pharmaceutical" also finds "pharmaceuticals"). */
export function degreeQuery(degree: string): string | null {
  const words = [...new Set(degree.toLowerCase().split(/[^\p{L}\p{N}]+/u))].filter((w) => w.length > 2 && !/^\d+$/.test(w) && !SIMILAR_STOP.has(w) && !DEGREE_STOP.has(w))
  return words.length ? words.slice(0, 12).map((w) => (w.length > 4 ? `${w}:*` : w)).join(' | ') : null
}

/**
 * "More like this": nearest neighbours of the vacancy's e5 embedding when the feed holds it (no model call),
 * else any of the title's words, ranked by text match. The vacancy itself is left out.
 */
async function similarTo(db: Db, like: { url: string; title: string }): Promise<{ where: SQL[]; order: SQL }> {
  // The same posting with tracking parameters or a trailing slash still counts ("?utm_source=…").
  const bare = like.url.split(/[?#]/)[0]!.replace(/\/$/, '')
  const [ref] = bare ? await db.select({ url: v.url }).from(v).where(and(sql`${v.embedding} is not null`, or(eq(v.url, like.url), eq(v.url, bare), sql`${v.url} like ${`${bare}?%`}`, eq(v.url, `${bare}/`)))).limit(1) : []
  const self = [ref?.url, like.url].filter(Boolean).map((u) => sql`${v.url} <> ${u}`)
  if (ref) {
    const e = sql`(select embedding from vacancy where url = ${ref.url})`
    return { where: [...self, sql`${v.embedding} is not null`], order: sql`${v.embedding} <=> ${e} asc` }
  }
  // ponytail: title words only (no description), so a pasted posting outside the feed gets rough neighbours; an on-the-fly e5 embedding would fix it.
  const words = titleWords(like.title).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean)
  if (!words.length) return { where: [...self, sql`false`], order: sql`1` }
  const title = sql`to_tsvector('simple', ${v.title})`
  const q = sql`to_tsquery('simple', ${words.join(' | ')})`
  return { where: [...self, sql`${title} @@ ${q}`], order: sql`ts_rank(${title}, ${q}) desc` }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const DAY = 86_400_000

/** Jev's verdict as a chip, on FIT_SCALE (score/3): 0 wrong field, 1/3 a stretch, 2/3 worth applying, 1 strong. */
const jevLabel = (jev: number) => (jev >= 0.83 ? 'Strong fit' : jev >= 0.5 ? 'Worth applying' : jev >= 0.17 ? 'A stretch' : null)

// The feed provider scores vacancy_fit on this same question and scale, so a pasted posting and a feed row read alike.
export const FIT_SCALE = ['Wrong field or level for this candidate', 'A stretch: some overlap but a different direction', 'Reasonable fit worth applying to', 'Strong fit: matches their field, skills and interests']
export const FIT_Q: ScoreQ = { type: 'score', criteria: FIT_SCALE, instructions: `How well does this job posting fit this candidate's background, skills and interests? ${FAIRNESS}` }

/** Jev's 0..3 fit score as 0..1 with its chip label. */
export const fitFrom = (score: number) => {
  const fit = Math.max(0, Math.min(1, score / (FIT_SCALE.length - 1)))
  return { fit, label: jevLabel(fit) ?? 'Different field or level' }
}

/** Jev's quick verdict on one posting for one CV, before the full evaluation. One typed call, ~$0.00002, booked on `meter`. */
export async function quickFit(env: Env, jdText: string, cv: string, meter: Meter, signal?: AbortSignal) {
  const answers = await jevDecide(env, { candidate: cv.slice(0, 3000), job: jdText.slice(0, 5000) }, { fit: FIT_Q }, meter, signal)
  return fitFrom(scoreOf(answers.fit))
}

/** Up to three plain reasons a role is in the seeker's feed, most telling first. `jev` is Jev's score where the feed provider wrote one. */
export function reasonsFor(
  r: { title: string; description: string | null; functions: string[]; fit: number; jev?: number | null; deadline: string | null; deadlineType: string; firstSeen: string },
  chosen: string[],
  skills: string[],
  today = new Date(),
): string[] {
  const out: string[] = []
  if (r.jev != null) {
    const label = jevLabel(r.jev)
    if (label) out.push(label)
  }
  const picked = r.functions.filter((fn) => chosen.includes(fn)).map((fn) => VACANCY_FUNCTIONS[fn as keyof typeof VACANCY_FUNCTIONS] ?? fn)
  if (picked.length) out.push(picked.join(' · '))
  const text = `${r.title}\n${r.description ?? ''}`
  const hits = skills.filter((s) => s.trim().length > 1 && new RegExp(`(^|[^\\p{L}\\p{N}])${escape(s.trim())}($|[^\\p{L}\\p{N}])`, 'iu').test(text))
  if (hits.length) out.push(`Mentions ${hits.slice(0, 3).join(', ')}`)
  const days = r.deadline ? Math.ceil((Date.parse(r.deadline) - today.getTime()) / DAY) : null
  if (days !== null && days <= 14) out.push(days <= 0 ? 'Closes today' : `Closes in ${days} day${days === 1 ? '' : 's'}`)
  else if ((today.getTime() - Date.parse(r.firstSeen)) / DAY < 3) out.push('New this week')
  return out.slice(0, 3)
}

/** Open-vacancy counts per country, function, industry, level and programme, for the filter menus. */
export async function vacancyFacets(db: Db): Promise<VacancyFacets> {
  const count = sql<number>`count(*)::int`
  const [countries, functions, industries, levels, programs] = await Promise.all([
    db.select({ k: v.country, n: count }).from(v).where(open()).groupBy(v.country),
    db.select({ k: sql<string>`unnest(${v.functions})`, n: count }).from(v).where(open()).groupBy(sql`1`),
    db.select({ k: v.industry, n: count }).from(v).where(open()).groupBy(v.industry),
    db.select({ k: v.level, n: count }).from(v).where(open()).groupBy(v.level),
    db.select({ k: v.program, n: count }).from(v).where(open()).groupBy(v.program),
  ])
  const map = (rows: { k: string | null; n: number }[]) => Object.fromEntries(rows.filter((r) => r.k).map((r) => [r.k!, Number(r.n)]))
  return { total: levels.reduce((a, r) => a + Number(r.n), 0), countries: map(countries), functions: map(functions), industries: map(industries), levels: map(levels), programs: map(programs) }
}
