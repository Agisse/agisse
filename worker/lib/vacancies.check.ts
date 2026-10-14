// Run: npx tsx worker/lib/vacancies.check.ts
import { and } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { FAIRNESS } from './pipeline.ts'
import { degreeQuery, FIT_Q, reasonsFor, titleWords, vacancyFilters, type VacancyQuery } from './vacancies.ts'

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
