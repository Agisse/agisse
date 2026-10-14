// Feed eval: does the "For you" feed work for every kind of graduate, not just finance?
// Seeds the 12 synthetic personas (scripts/personas.ts) into DATABASE_URL, ranks each one's feed with the filters a real seeker
// sets (level any, their countries, their fields) and prints how many roles pass, how on-field the top 30 is and how many employers it shows.
// Run: npm run eval:feed [-- --save-baseline]   No model calls. Writes eval/results/feed-baseline.json with --save-baseline.
// Use a development database only: it adds 12 users without a password (persona-*@example.com).
import { mkdirSync, writeFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { createDb, schema } from '../worker/db'
import { searchVacancies, type VacancyQuery } from '../worker/lib/vacancies'
import { EMPTY_FEED_PREFS } from '../shared/listings'
import { EMPTY_PROFILE } from '../shared/types'
import { PERSONAS, TARGETS, feedMetrics } from './personas'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const db = createDb(url)

const results = []
for (const p of PERSONAS) {
  const id = `persona-${p.slug}`
  const jobFeed = { ...EMPTY_FEED_PREFS, countries: p.countries, functions: p.fields }
  const data = { ...EMPTY_PROFILE, headline: p.headline, degree: p.degree, targetIndustries: p.targetIndustries, jobFeed }
  await db.insert(schema.user).values({ id, name: `${p.headline} (persona)`, email: `persona-${p.slug}@example.com` }).onConflictDoNothing()
  await db.insert(schema.profile).values({ userId: id, data }).onConflictDoUpdate({ target: schema.profile.userId, set: { data, updatedAt: sql`now()` } })

  const f: VacancyQuery = { q: '', countries: p.countries, level: 'any', functions: p.fields, industries: [], languages: [], remoteOnly: false, deadlineWithin: null, sort: 'match', offset: 0 }
  const { vacancies, total } = await searchVacancies(db, id, f, p.targetIndustries, p.degree)
  results.push({ persona: p.slug, countries: p.countries, fields: p.fields, ...feedMetrics(total, vacancies, p.fields) })
}

const pct = (x: number) => `${Math.round(100 * x)}%`
console.log(`Targets: >=${TARGETS.roles} roles, >=${pct(TARGETS.onField)} on-field (tags and titles), >=${TARGETS.employers} employers in the top 30.\n`)
console.table(results.map((r) => ({ persona: r.persona, roles: r.roles, 'on-field tags': pct(r.onFieldFunctions), 'on-field titles': pct(r.onFieldTitle), employers: r.employers, pass: r.pass ? 'yes' : 'no' })))
console.log(`${results.filter((r) => r.pass).length}/${results.length} personas meet every target.`)

if (process.argv.includes('--save-baseline')) {
  mkdirSync('eval/results', { recursive: true })
  writeFileSync('eval/results/feed-baseline.json', `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), targets: TARGETS, results }, null, 2)}\n`)
  console.log('Saved eval/results/feed-baseline.json')
}
