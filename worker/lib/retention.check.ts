// Run: npx tsx --env-file=.dev.vars worker/lib/retention.check.ts
// Needs a (development) DATABASE_URL; without one it only says so. Creates synthetic @example.com accounts and deletes them.
import { and, eq, inArray, like, lt, sql } from 'drizzle-orm'
import { createDb, schema } from '../db/index.ts'
import { pruneExaCache } from './exa.ts'
import { deleteInactiveAccounts, deleteStaleDeclined, eraseOutsideCascade, pruneModelOutput } from './retention.ts'

// Erasure tells PostHog only when both PostHog vars are set, with the ids and nothing else; a PostHog failure never blocks it.
{
  const calls: { url: string; init: RequestInit }[] = []
  const realFetch = globalThis.fetch
  let status = 202
  globalThis.fetch = (async (url: string, init: RequestInit) => (calls.push({ url: String(url), init }), new Response('{}', { status }))) as typeof fetch
  const noDb = { delete: () => ({ where: async () => {} }) } as unknown as Parameters<typeof eraseOutsideCascade>[1]
  const pdfs: string[] = []
  const RESUMES = { delete: async (key: string) => void pdfs.push(key) }
  try {
    await eraseOutsideCascade({ RESUMES }, noDb, ['u1'])
    await eraseOutsideCascade({ RESUMES, POSTHOG_PERSONAL_API_KEY: 'phx_test' }, noDb, ['u1'])
    if (calls.length) throw new Error('posthog: called without POSTHOG_API_URL')
    await eraseOutsideCascade({ RESUMES, POSTHOG_PERSONAL_API_KEY: 'phx_test', POSTHOG_API_URL: 'https://eu.posthog.example.com/api/projects/1/' }, noDb, ['u1', 'u2'])
    const [call] = calls
    if (call?.url !== 'https://eu.posthog.example.com/api/projects/1/persons/bulk_delete/') throw new Error(`posthog: url ${call?.url}`)
    if ((call.init.headers as Record<string, string>).authorization !== 'Bearer phx_test') throw new Error('posthog: no bearer key')
    if (call.init.body !== JSON.stringify({ distinct_ids: ['u1', 'u2'], delete_events: true })) throw new Error(`posthog: body ${call.init.body}`)
    status = 500
    await eraseOutsideCascade({ RESUMES, POSTHOG_PERSONAL_API_KEY: 'phx_test', POSTHOG_API_URL: 'https://eu.posthog.example.com/api/projects/1' }, noDb, ['u3'])
    if (!pdfs.includes('resumes/u3.pdf') || calls.length !== 2) throw new Error('posthog: a failed call blocked the erasure')
    console.log('posthog forget ok')
  } finally {
    globalThis.fetch = realFetch
  }
}

const url = process.env.DATABASE_URL
const db = url ? createDb(url) : null
// deleteStaleDeclined works on the whole table, so never run it where other accounts could match.
const others = db && (await db.select({ id: schema.user.id }).from(schema.user).where(and(eq(schema.user.accessStatus, 'rejected'), lt(schema.user.createdAt, sql`now() - interval '11 months'`))).limit(1))
if (!db || others?.length) {
  console.log(`retention ok (skipped: ${db ? 'this database has older declined accounts' : 'no DATABASE_URL'})`)
} else {
  const run = Date.now()
  const old = new Date(Date.now() - 400 * 24 * 3600_000)
  const account = (key: string, accessStatus: 'approved' | 'rejected', createdAt: Date) =>
    ({ id: `retention-${run}-${key}`, name: 'Sam Example', email: `retention-${run}-${key}@example.com`, accessStatus, createdAt })
  const users = [
    account('stale', 'rejected', old),
    account('declined', 'rejected', old),
    account('recent-session', 'rejected', old),
    account('new', 'rejected', new Date()),
    account('approved', 'approved', old),
  ]
  const deleted = new Set<string>()
  const files = { delete: async (key: string) => void deleted.add(key) }
  try {
    await db.insert(schema.user).values(users)
    await db.insert(schema.session).values({ id: `retention-${run}`, token: `retention-${run}`, userId: users[2].id, expiresAt: new Date(Date.now() + 86_400_000) })
    await db.insert(schema.oauthConsent).values({ id: `retention-${run}`, clientId: 'retention-check', userId: users[0].id, scopes: ['openid'] })
    await deleteStaleDeclined({ RESUMES: files }, db)
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
    declined: account('declined', { accessStatus: 'rejected' as const }),
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
  const mailEnv = (extra: object) => ({ APP_URL: 'https://example.com', RESUMES: files, ...extra }) as unknown as Env
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
    await deleteInactiveAccounts(mailEnv({}), db)
    let left = await state()
    check(!left.has(a.warnedIdle.id) && deleted.has(`resumes/${a.warnedIdle.id}.pdf`), 'warned 40 days ago and unused since: deleted with its PDF')
    check(!sent.length && left.get(a.idle.id) === null, 'no RESEND_API_KEY: nobody warned')

    await deleteInactiveAccounts(mailEnv({ RESEND_API_KEY: 're_test' }), db)
    left = await state()
    check(sent.sort().join() === [a.idle.email, a.mailFails.email].sort().join(), `mailed only the unused, unwarned accounts: ${sent.join()}`)
    check(left.get(a.idle.id) instanceof Date, 'idle account marked as warned')
    check(left.get(a.mailFails.id) === null, 'a failed email marks nothing')
    for (const u of [a.warnedBack, a.warnedRecent, a.session, a.mcp, a.admin, a.declined, a.fresh, a.idle, a.mailFails]) check(left.has(u.id), `${u.id} kept`)

    // A second run the same day sends nothing new and deletes nothing: the warning is 30 days old at the earliest.
    sent.length = 0
    await deleteInactiveAccounts(mailEnv({ RESEND_API_KEY: 're_test' }), db)
    check(sent.join() === a.mailFails.email && (await state()).size === users.length - 1, 'second run: only the failed email is tried again')
    console.log('inactive accounts ok')
  } finally {
    globalThis.fetch = realFetch
    await db.delete(schema.user).where(inArray(schema.user.id, users.map((u) => u.id)))
    await db.delete(schema.oauthAccessToken).where(eq(schema.oauthAccessToken.clientId, 'inactive-check'))
  }
}

// pruneModelOutput and pruneExaCache work on the whole table too: skip unless only this check's rows are old enough to match.
const olderOutput =
  db &&
  ((await db.select({ id: schema.usage.id }).from(schema.usage).where(and(lt(schema.usage.createdAt, sql`now() - interval '89 days'`), sql`(${schema.usage.output} is not null or ${schema.usage.note} is not null)`)).limit(1)).length ||
    (await db.select({ key: schema.exaCache.key }).from(schema.exaCache).where(lt(schema.exaCache.createdAt, sql`now() - interval '6 days'`)).limit(1)).length)
if (!db || olderOutput) {
  console.log(`model output ok (skipped: ${db ? 'this database has older model output or Exa rows' : 'no DATABASE_URL'})`)
} else {
  const run = Date.now()
  const id = `output-${run}`
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000)
  const row = (key: string, createdAt: Date) => ({ id: `${id}-${key}`, userId: id, kind: 'cv' as const, tokens: 10, costUsd: 0.01, output: { text: 'Example' }, rating: -1, note: 'Too long', createdAt })
  try {
    await db.insert(schema.user).values({ id, name: 'Sam Example', email: `${id}@example.com` })
    await db.insert(schema.usage).values([row('old', daysAgo(91)), row('new', daysAgo(89))])
    await db.insert(schema.exaCache).values([{ key: `${id}-old`, results: [], createdAt: daysAgo(8) }, { key: `${id}-new`, results: [], createdAt: daysAgo(6) }])
    await pruneModelOutput(db)
    await pruneExaCache(db)
    const rows = new Map((await db.select().from(schema.usage).where(eq(schema.usage.userId, id))).map((r) => [r.id, r]))
    const old = rows.get(`${id}-old`), recent = rows.get(`${id}-new`)
    if (!old || old.output !== null || old.note !== null || old.costUsd !== 0.01 || old.rating !== -1) throw new Error('model output: a 91-day-old row keeps its cost and rating, loses output and note')
    if (!recent?.output || !recent.note) throw new Error('model output: an 89-day-old row is untouched')
    const keys = (await db.select({ key: schema.exaCache.key }).from(schema.exaCache).where(like(schema.exaCache.key, `${id}-%`))).map((r) => r.key)
    if (keys.join() !== `${id}-new`) throw new Error(`exa cache: only the 6-day-old row stays, got ${keys.join()}`)
    console.log('model output ok')
  } finally {
    await db.delete(schema.user).where(eq(schema.user.id, id))
    await db.delete(schema.exaCache).where(like(schema.exaCache.key, `${id}-%`))
  }
}
