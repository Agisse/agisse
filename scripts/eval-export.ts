// Exports the administrator's own résumé and recent postings as private eval fixtures (eval/fixtures/private/, gitignored).
// Only the admin's data: other seekers' CVs never leave the database. Reads only.
// Run: npm run eval:export [-- limit]
import { mkdirSync, writeFileSync } from 'node:fs'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { createDb, schema } from '../worker/db'
import { ADMIN_EMAIL } from '../worker/auth'
import { EMPTY_PROFILE } from '../shared/types'

const db = createDb(process.env.DATABASE_URL!)
const admin = await db.query.user.findFirst({ where: eq(schema.user.email, ADMIN_EMAIL) })
if (!admin) throw new Error(`No account for ${ADMIN_EMAIL}`)
const profile = await db.query.profile.findFirst({ where: eq(schema.profile.userId, admin.id) })
if (!profile?.resumeText) throw new Error('Import a résumé on your badge first: fixtures need the source CV.')
const jobs = await db.query.job.findMany({ where: eq(schema.job.userId, admin.id), orderBy: desc(schema.job.createdAt), limit: Number(process.argv[2]) || 8 })
const people = await db
  .select({ person: schema.person, search: schema.search })
  .from(schema.person)
  .innerJoin(schema.search, eq(schema.person.searchId, schema.search.id))
  .where(and(eq(schema.person.userId, admin.id), isNotNull(schema.person.contactedAt)))
  .orderBy(desc(schema.person.contactedAt))
  .limit(20)

mkdirSync('eval/fixtures/private', { recursive: true })
for (const [i, j] of jobs.entries()) {
  // Expected band: the score the evaluation gave then, ±0.5; a drift beyond it is worth a look either way.
  const match = people.find((p) => p.search.company.toLowerCase() === j.company.toLowerCase()) ?? people[i]
  const fixture = {
    name: `private-${j.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${j.id.slice(0, 6)}`,
    seekerName: admin.name,
    resume: profile.resumeText,
    profile: { ...EMPTY_PROFILE, ...profile.data },
    posting: j.jdText,
    expectScore: [Math.max(1, j.score - 0.5), Math.min(5, j.score + 0.5)],
    ...(match && {
      person: (({ name, title, company, location, summary, sharedGround, reason, value }) => ({ name, title, company, location, summary, sharedGround, reason, value }))(match.person),
      search: { company: match.search.company, role: match.search.role, goal: match.search.goal ?? undefined },
    }),
  }
  writeFileSync(`eval/fixtures/private/${fixture.name}.json`, JSON.stringify(fixture, null, 2))
  console.log('wrote', fixture.name)
}
