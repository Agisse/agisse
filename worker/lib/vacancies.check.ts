// Run: npx tsx worker/lib/vacancies.check.ts (add --env-file=.dev.vars for the database part)
import { and, eq as is } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { createDb, schema } from '../db/index.ts'
import { FAIRNESS } from './pipeline.ts'
import { dedupe, degreeQuery, FIT_Q, reasonsFor, seekerOf, stageOf, titleWords, vacancyFilters, type VacancyQuery } from './vacancies.ts'
import { languagesInResume, spokenLanguages } from '../../shared/listings.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const pg = new PgDialect({ casing: 'snake_case' })
const base: VacancyQuery = { q: '', countries: [], level: 'any', functions: [], industries: [], languages: [], remoteOnly: false, deadlineWithin: null, sort: 'match', offset: 0 }
const render = (f: Partial<VacancyQuery>) => pg.sqlToQuery(and(...vacancyFilters({ ...base, ...f }))!)

// No dealbreakers: only the "still open" rule.
const open = render({})
eq(open.params, [], 'open params')
if (!/"closed_at" is null/.test(open.sql) || !/current_date - 3/.test(open.sql)) throw new Error(`open rule missing: ${open.sql}`)

// Each dealbreaker becomes one parameterised clause; nothing user-typed is spliced into the SQL.
const all = render({ q: "m&a'; drop table vacancy", countries: ['BE', 'NL'], level: 'internship', functions: ['m&a'], industries: ['banking'], languages: ['english', 'dutch'], remoteOnly: true, deadlineWithin: 14 })
eq(all.params, ['internship', 'BE', 'NL', 'EU', 'm&a', 'banking', 'english', 'dutch', true, 14, "m&a'; drop table vacancy"], 'params')
for (const bit of ['"level" = $1', '"country" = ANY(ARRAY[$2, $3]::text[])', '"country" = $4', '"functions" && ARRAY[$5]::text[]', '"langs_required" <@ ARRAY[$7, $8]::text[]', "websearch_to_tsquery('simple', $11)"])
  if (!all.sql.includes(bit)) throw new Error(`missing ${bit} in ${all.sql}`)
if (all.sql.includes('drop table')) throw new Error('query text leaked into SQL')

// Everything scraped is early-career: "experienced" shows nothing rather than everything.
if (!render({ level: 'experienced' }).sql.includes('false')) throw new Error('experienced should match nothing')

// Reasons: fit, chosen functions, shared skills, then deadline or freshness; at most three.
const today = new Date('2026-09-29T12:00:00Z')
const row = { title: 'M&A Summer Analyst', description: 'Build DCF models in Excel for sell-side deals.', functions: ['ib', 'm&a'], fit: 0.8, deadline: '2026-10-05', deadlineType: 'explicit', firstSeen: '2026-09-01' }
eq(reasonsFor(row, ['m&a'], ['DCF', 'Excel', 'Python'], today), ['M&A & transactions', 'Mentions DCF, Excel', 'Closes in 6 days'], 'reasons')
eq(reasonsFor({ ...row, fit: 0.3 }, [], [], today), ['Closes in 6 days'], 'deadline reason')
eq(reasonsFor({ ...row, fit: 0.3, deadline: null, firstSeen: '2026-09-28' }, [], [], today), ['New this week'], 'fresh reason')
eq(reasonsFor({ ...row, fit: 0.3, deadline: null }, [], ['C'], today), [], 'one-letter skills ignored')

// Jev's score (vacancy_fit) comes first and replaces the cosine heuristic; a "wrong field" score shows no fit chip.
eq(reasonsFor({ ...row, jev: 1 }, ['m&a'], [], today), ['Strong fit', 'M&A & transactions', 'Closes in 6 days'], 'jev strong')
eq(reasonsFor({ ...row, fit: 0.2, jev: 2 / 3 }, [], [], today)[0], 'Worth applying', 'jev worth applying')
eq(reasonsFor({ ...row, jev: 1 / 3 }, [], [], today)[0], 'A stretch', 'jev stretch')
eq(reasonsFor({ ...row, jev: 0 }, [], [], today), ['Closes in 6 days'], 'jev wrong field: no chip, no heuristic')
// Cosine alone sits in 0.83–0.87 for a whole field, so it never claims a fit.
eq(reasonsFor({ ...row, jev: null }, [], [], today), ['Closes in 6 days'], 'no jev: no chip')
// What held a role back comes right after the fit chip; language names among the skills never count as "Mentions".
eq(reasonsFor({ ...row, jev: 1, unspoken: ['german'] }, [], ['English', 'Excel'], today), ['Strong fit', 'Asks for German', 'Mentions Excel'], 'unspoken language')
eq(reasonsFor({ ...row, minYears: 3, liked: 0.9 }, [], [], today), ['Asks for 3+ years', 'Like roles you saved', 'Closes in 6 days'], 'years and taste')
eq(reasonsFor({ ...row, liked: 0.6 }, [], [], today), ['Closes in 6 days'], 'a loose likeness says nothing')
// Stage from the graduation year (in October 2026): next year is the final year; two years out is early; past July is graduated.
const oct = new Date('2026-10-17T12:00:00Z')
eq([stageOf('2025', oct), stageOf('2026', oct), stageOf('2027', oct), stageOf('2028', oct), stageOf('', oct)], ['graduated', 'graduated', 'final', 'early', null], 'stages')
eq(stageOf('2026', new Date('2026-03-01T12:00:00Z')), 'final', 'graduating this spring')
// Spoken languages: native names and levels; English added once any is known; none known stays unknown.
eq(spokenLanguages(['Nederlands (moedertaal)', 'Français C1', 'Python', 'German']), ['dutch', 'french', 'german'], 'spoken languages')
eq(seekerOf({ skills: ['Excel', 'Dutch'], targetIndustries: [], degree: '', gradYear: '' }).languages, ['english', 'dutch'], 'languages from skills')
eq(seekerOf({ skills: ['Excel'], targetIndustries: [], degree: '', gradYear: '' }).languages, [], 'no languages known')
eq(seekerOf({ skills: [], targetIndustries: [], degree: '', gradYear: '' }, 'Experience\nGerman multinational\nLanguages: Dutch (native), French (fluent)').languages, ['english', 'dutch', 'french'], 'languages from the résumé section')
eq(languagesInResume('Worked for a German bank. Studied French literature.'), [], 'language words outside the section')
eq(languagesInResume('Native Spanish speaker, fluent in Italian'), ['spanish', 'italian'], 'native / fluent')
// The same posting from two sources: one row, the first (better-ranked) one.
eq(dedupe([{ title: 'Internship Coverage Analyst', company: 'Société Générale', n: 1 }, { title: 'Internship  Coverage Analyst', company: 'Societe Generale CIB', n: 2 }, { title: 'Internship Coverage Analyst', company: 'ING', n: 3 }]).map((r) => r.n), [1, 3], 'dedupe')
// Programme types and "just opened" are parameterised like the rest.
const views = render({ programs: ['summer', 'graduate_programme'], newWithin: 7 })
eq(views.params, ['summer', 'graduate_programme', 7], 'programme + new params')
if (!views.sql.includes('"program" = ANY(ARRAY[$1, $2]::text[])') || !views.sql.includes('"first_seen" >= current_date - $3::int')) throw new Error(`programme/new missing: ${views.sql}`)
// Similar-roles fallback: meaningful title words only.
eq(titleWords('Summer Analyst 2027 - M&A (m/f/d), London'), ['analyst', 'm&a'], 'title words')
// Cold start: the degree's field words, prefixes for longer ones, nothing for a degree that names no field.
eq(degreeQuery('MSc Pharmaceutical Sciences'), 'pharmaceutical:*', 'degree query')
eq(degreeQuery('BA Marketing and Communication'), 'marketing:* | communication:*', 'degree query, two words')
eq(degreeQuery('LLB Law'), 'law', 'short word: exact')
eq(degreeQuery("Bachelor of Arts (Hons) 2024 & l'été"), 'été', 'only letters reach to_tsquery')
eq(degreeQuery('MSc'), null, 'no field words')
// The feed's fit question carries the same rule as the evaluation prompt.
if (!FIT_Q.instructions.includes(FAIRNESS)) throw new Error('FIT_Q lacks FAIRNESS')
console.log('vacancies ok')

// Owner decision D3: a closed role leaves the feed but its row stays, so first_seen and closed_at build the recruiting calendar.
if (process.env.DATABASE_URL) {
  const db = createDb(process.env.DATABASE_URL)
  const url = `https://example.com/jobs/closed-check-${Date.now()}`
  const v = schema.vacancy
  try {
    await db.insert(v).values({ url, source: 'seed', company: 'Example Corp', title: 'Graduate Analyst', firstSeen: '2025-09-03', lastSeen: new Date().toISOString().slice(0, 10), closedAt: new Date().toISOString().slice(0, 10) })
    const inFeed = await db.select({ url: v.url }).from(v).where(and(is(v.url, url), ...vacancyFilters(base)))
    const kept = await db.select({ firstSeen: v.firstSeen, closedAt: v.closedAt }).from(v).where(is(v.url, url))
    eq(inFeed.length, 0, 'a closed role in the feed')
    eq(kept.length === 1 && kept[0].firstSeen === '2025-09-03' && !!kept[0].closedAt, true, 'the closed row kept with its dates')
    console.log('closed roles kept ok')
  } finally {
    await db.delete(v).where(is(v.url, url))
  }
} else console.log('closed roles kept ok (skipped: no DATABASE_URL)')
