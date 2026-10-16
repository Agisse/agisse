// Run: npx tsx worker/lib/programmes.check.ts
import { and } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { programmeFilters, type ProgrammeQuery } from './programmes.ts'
import { countryLabel, EUROPE, fieldLabel, nextKinds } from '../../shared/programmes.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const pg = new PgDialect({ casing: 'snake_case' })
const base: ProgrammeQuery = { q: '', kinds: [], countries: [], fields: [], languages: [], maxTuition: null, deadlineWithin: null, saved: false, offset: 0 }
const render = (f: Partial<ProgrammeQuery>) => pg.sqlToQuery(and(...programmeFilters({ ...base, ...f }, 'u1'))!)

// No filters: only the open rule. Closed rows are archived, never deleted, so the rule is closed_at, not last_seen.
const open = render({})
eq(open.params, [], 'open params')
if (!/"closed_at" is null/.test(open.sql) || !/"deadline" >= current_date/.test(open.sql)) throw new Error(`open rule missing: ${open.sql}`)

// Each filter is one parameterised clause; nothing typed is spliced into the SQL.
const all = render({ q: "econ'; drop table programme", kinds: ['master', 'phd'], countries: ['NL'], fields: ['economics'], languages: ['english'], maxTuition: 15000, deadlineWithin: 30 })
eq(all.params, ['master', 'phd', 'NL', 'economics', 'english', 15000, 30, "econ'; drop table programme"], 'params')
for (const bit of ['"kind" = ANY(ARRAY[$1, $2]::text[])', '"country" = ANY(ARRAY[$3]::text[])', '"fields" && ARRAY[$4]::text[]', '"languages" && ARRAY[$5]::text[]', '"tuition_eur" <= $6', "websearch_to_tsquery('simple', $8)"])
  if (!all.sql.includes(bit)) throw new Error(`missing ${bit} in ${all.sql}`)
if (all.sql.includes('drop table')) throw new Error('query text leaked into SQL')

// The saved list is the seeker's own and keeps programmes that closed since.
const saved = render({ saved: true })
eq(saved.params, ['u1'], 'saved params')
if (saved.sql.includes('closed_at')) throw new Error(`saved list should keep closed programmes: ${saved.sql}`)

// The next step after the seeker's degree.
eq(nextKinds('MSc Financial Economics'), ['phd', 'phd_position'], 'after a master')
eq(nextKinds('BA Economics and Management'), ['master', 'mba'], 'after a bachelor')
eq(nextKinds('Bachelor of Science in Business'), ['master', 'mba'], 'bachelor of science')
eq(nextKinds(''), [], 'no degree')
// Labels: the job feed's field names, else the provider's; countries worldwide.
eq(fieldLabel('consulting'), 'Consulting', 'known field')
eq(fieldLabel('computer science'), 'Computer science', 'free field')
eq(countryLabel('US'), 'United States', 'country')
eq(countryLabel('nl'), 'Netherlands', 'lower-case country')
// Europe first: the EU, the EEA, the UK and Switzerland, nothing else.
eq(EUROPE.length, 32, 'European countries')
for (const c of ['GB', 'CH', 'NO', 'BE']) if (!EUROPE.includes(c)) throw new Error(`${c} missing from EUROPE`)
for (const c of ['US', 'IN', 'SG', 'TR']) if (EUROPE.includes(c)) throw new Error(`${c} in EUROPE`)
console.log('programmes ok')
