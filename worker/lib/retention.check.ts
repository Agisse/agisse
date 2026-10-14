// Run: npx tsx --env-file=.dev.vars worker/lib/retention.check.ts
// Needs a (development) DATABASE_URL; without one it only says so. Creates synthetic @example.com accounts and deletes them.
import { and, eq, inArray, like, lt, sql } from 'drizzle-orm'
import { createDb, schema } from '../db/index.ts'
import { deleteStaleWaitlist } from './retention.ts'

const url = process.env.DATABASE_URL
const db = url ? createDb(url) : null
// deleteStaleWaitlist works on the whole table, so never run it where other accounts could match.
const others = db && (await db.select({ id: schema.user.id }).from(schema.user).where(and(inArray(schema.user.accessStatus, ['pending', 'rejected']), lt(schema.user.createdAt, sql`now() - interval '11 months'`))).limit(1))
if (!db || others?.length) {
  console.log(`retention ok (skipped: ${db ? 'this database has older waitlist accounts' : 'no DATABASE_URL'})`)
} else {
  const run = Date.now()
  const old = new Date(Date.now() - 400 * 24 * 3600_000)
  const account = (key: string, accessStatus: 'pending' | 'approved' | 'rejected', createdAt: Date) =>
    ({ id: `retention-${run}-${key}`, name: 'Sam Example', email: `retention-${run}-${key}@example.com`, accessStatus, createdAt })
  const users = [
    account('stale', 'pending', old),
    account('declined', 'rejected', old),
    account('recent-session', 'pending', old),
    account('new', 'pending', new Date()),
    account('approved', 'approved', old),
  ]
  const deleted = new Set<string>()
  const files = { delete: async (key: string) => void deleted.add(key) }
  try {
    await db.insert(schema.user).values(users)
    await db.insert(schema.session).values({ id: `retention-${run}`, token: `retention-${run}`, userId: users[2].id, expiresAt: new Date(Date.now() + 86_400_000) })
    await db.insert(schema.oauthConsent).values({ id: `retention-${run}`, clientId: 'retention-check', userId: users[0].id, scopes: ['openid'] })
    await deleteStaleWaitlist(db, files)
    const left = new Set((await db.select({ id: schema.user.id }).from(schema.user).where(like(schema.user.email, `retention-${run}-%`))).map((u) => u.id))
    const expectGone = [users[0].id, users[1].id]
    for (const u of users) if (left.has(u.id) === expectGone.includes(u.id)) throw new Error(`${u.id}: ${left.has(u.id) ? 'kept' : 'deleted'}`)
    for (const id of expectGone) if (!deleted.has(`resumes/${id}.pdf`)) throw new Error(`${id}: CV PDF not deleted`)
    if ((await db.select().from(schema.oauthConsent).where(eq(schema.oauthConsent.clientId, 'retention-check'))).length) throw new Error('OAuth consent left behind')
    console.log('retention ok')
  } finally {
    await db.delete(schema.user).where(inArray(schema.user.id, users.map((u) => u.id)))
    await db.delete(schema.oauthConsent).where(eq(schema.oauthConsent.clientId, 'retention-check'))
  }
}
