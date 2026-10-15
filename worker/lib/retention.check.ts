// Run: npx tsx --env-file=.dev.vars worker/lib/retention.check.ts
// Needs a (development) DATABASE_URL; without one it only says so. Creates synthetic @example.com accounts and deletes them.
import { and, eq, inArray, like, lt, sql } from 'drizzle-orm'
import { createDb, schema } from '../db/index.ts'
import { deleteInactiveAccounts, deleteStaleWaitlist } from './retention.ts'

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

// deleteInactiveAccounts also works on the whole table: skip unless no other approved account is near 24 months unused.
const olderApproved = db && (await db.select({ id: schema.user.id }).from(schema.user).where(and(eq(schema.user.accessStatus, 'approved'), lt(schema.user.createdAt, sql`now() - interval '23 months'`), sql`${schema.user.email} not like 'inactive-%@example.com'`)).limit(1))
if (!db || olderApproved?.length) {
  console.log(`inactive accounts ok (skipped: ${db ? 'this database has older approved accounts' : 'no DATABASE_URL'})`)
} else {
  const run = Date.now()
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000)
  const account = (key: string, extra: Partial<typeof schema.user.$inferInsert> = {}) =>
    ({ id: `inactive-${run}-${key}`, name: 'Sam Example', email: `inactive-${run}-${key}@example.com`, accessStatus: 'approved' as const, createdAt: daysAgo(1100), ...extra })
  const a = {
    idle: account('idle'),
    mailFails: account('mailfails'),
    warnedIdle: account('warnedidle', { inactiveWarnedAt: daysAgo(40) }),
    warnedBack: account('warnedback', { inactiveWarnedAt: daysAgo(40) }),
    warnedRecent: account('warnedrecent', { inactiveWarnedAt: daysAgo(10) }),
    session: account('session'),
    mcp: account('mcp'),
    admin: account('admin', { isAdmin: true }),
    pending: account('pending', { accessStatus: 'pending' }),
    fresh: account('fresh', { createdAt: daysAgo(30) }),
  }
  const users = Object.values(a)
  const deleted = new Set<string>()
  const files = { delete: async (key: string) => void deleted.add(key) }
  const sent: string[] = []
  const realFetch = globalThis.fetch
  // Resend only: the Neon driver talks to the database over fetch too.
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    if (!String(url).startsWith('https://api.resend.com/')) return realFetch(url, init)
    const to = JSON.parse(String(init.body)).to as string
    sent.push(to)
    return new Response('{}', { status: to === a.mailFails.email ? 500 : 200 })
  }) as typeof fetch
  const mailEnv = (extra: object) => ({ APP_URL: 'https://example.com', ...extra }) as unknown as Env
  const state = async () =>
    new Map((await db.select({ id: schema.user.id, warned: schema.user.inactiveWarnedAt }).from(schema.user).where(like(schema.user.email, `inactive-${run}-%`))).map((u) => [u.id, u.warned]))
  const check = (ok: boolean, what: string) => {
    if (!ok) throw new Error(`inactive accounts: ${what}`)
  }
  try {
    await db.insert(schema.user).values(users)
    await db.insert(schema.session).values([a.warnedBack, a.session].map((u) => ({ id: `${u.id}-s`, token: `${u.id}-s`, userId: u.id, expiresAt: daysAgo(-20), updatedAt: daysAgo(10) })))
    await db.insert(schema.oauthAccessToken).values({ id: `${a.mcp.id}-t`, token: `${a.mcp.id}-t`, clientId: 'inactive-check', userId: a.mcp.id, createdAt: daysAgo(30), expiresAt: daysAgo(29), scopes: ['openid'] })

    // Without mail, nobody new is warned; an account warned before is still deleted on time.
    await deleteInactiveAccounts(mailEnv({}), db, files)
    let left = await state()
    check(!left.has(a.warnedIdle.id) && deleted.has(`resumes/${a.warnedIdle.id}.pdf`), 'warned 40 days ago and unused since: deleted with its PDF')
    check(!sent.length && left.get(a.idle.id) === null, 'no RESEND_API_KEY: nobody warned')

    await deleteInactiveAccounts(mailEnv({ RESEND_API_KEY: 're_test' }), db, files)
    left = await state()
    check(sent.sort().join() === [a.idle.email, a.mailFails.email].sort().join(), `mailed only the unused, unwarned accounts: ${sent.join()}`)
    check(left.get(a.idle.id) instanceof Date, 'idle account marked as warned')
    check(left.get(a.mailFails.id) === null, 'a failed email marks nothing')
    for (const u of [a.warnedBack, a.warnedRecent, a.session, a.mcp, a.admin, a.pending, a.fresh, a.idle, a.mailFails]) check(left.has(u.id), `${u.id} kept`)

    // A second run the same day sends nothing new and deletes nothing: the warning is 30 days old at the earliest.
    sent.length = 0
    await deleteInactiveAccounts(mailEnv({ RESEND_API_KEY: 're_test' }), db, files)
    check(sent.join() === a.mailFails.email && (await state()).size === users.length - 1, 'second run: only the failed email is tried again')
    console.log('inactive accounts ok')
  } finally {
    globalThis.fetch = realFetch
    await db.delete(schema.user).where(inArray(schema.user.id, users.map((u) => u.id)))
    await db.delete(schema.oauthAccessToken).where(eq(schema.oauthAccessToken.clientId, 'inactive-check'))
  }
}
