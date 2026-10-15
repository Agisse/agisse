// Run: npx tsx worker/index.check.ts (CI: app shell only), or npx tsx --env-file=.env worker/index.check.ts
// Boots the Worker with only the required secrets, so every optional key is missing, and hits the main routes.
// With a DATABASE_URL it signs up a synthetic user on that (development) database and deletes it afterwards.
import { readFileSync } from 'node:fs'
import { eq, sql } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import worker from './index.ts'
import { createDb, schema } from './db/index.ts'
import { FEED_CAP_MESSAGE, FEED_DAILY_PAGES, feedCapDays, MAX_OFFSET, pruneFeedDays } from './lib/vacancies.ts'
import { freeLimitDays, freeLimitToday, spendThisMonth, spendToday } from './lib/shared.ts'
import { pruneAdminActions } from './lib/retention.ts'

const check = (ok: boolean, what: string, got?: unknown) => { if (!ok) throw new Error(`${what}${got === undefined ? '' : `: got ${JSON.stringify(got)}`}`) }

const vars = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, '')).vars as Record<string, string>
const databaseUrl = process.env.DATABASE_URL
const files = new Map<string, unknown>()
const RESUMES = {
  put: async (key: string, body: unknown) => void files.set(key, body),
  get: async (key: string) => (files.has(key) ? { arrayBuffer: async () => new TextEncoder().encode(String(files.get(key))).buffer } : null),
  delete: async (key: string) => void files.delete(key),
}
const env = { ...vars, DATABASE_URL: databaseUrl ?? 'postgresql://user:password@db.example.com/none', BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'index-check-secret-index-check-secret', ASSETS: { fetch: () => new Response('app shell') }, RESUMES } as unknown as Env
// Node has no Cache API; edgeCached() then always misses.
Object.assign(globalThis, { caches: { default: { match: async () => undefined, put: async () => {} } } })
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext

let cookie = ''
async function call(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { origin: 'http://localhost', cookie }
  if (body) headers['content-type'] = 'application/json'
  const res = await worker.fetch(new Request(`http://localhost${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }) as never, env, ctx)
  const setCookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  if (setCookie) cookie = setCookie
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null }
}

// GDPR erasure: every table with a user_id goes with the user row (foreign key, on delete cascade), except Better Auth's
// OAuth tables, which have no foreign key; the database part below deletes an account that has rows in them.
const userTables = Object.values(schema).filter((t: unknown): t is PgTable => t instanceof PgTable).map(getTableConfig).filter((t) => t.columns.some((c) => c.name === 'user_id'))
const NO_FOREIGN_KEY = ['oauth_access_token', 'oauth_consent', 'oauth_refresh_token']
for (const t of userTables) {
  const cascades = t.foreignKeys.some((f) => f.reference().columns[0]?.name === 'user_id' && getTableConfig(f.reference().foreignTable).name === 'user' && f.onDelete === 'cascade')
  check(cascades !== NO_FOREIGN_KEY.includes(t.name), `${t.name}: cascade from user, or list it in NO_FOREIGN_KEY`)
}

// The app shell needs no database; /api routes all set up auth, which does.
const shell = await worker.fetch(new Request('http://localhost/') as never, env, ctx)
check(shell.status === 200 && shell.headers.get('x-content-type-options') === 'nosniff', 'app shell', shell.status)

if (!databaseUrl) {
  console.log('index ok (no DATABASE_URL: app shell only)')
} else {
  const email = `index-check-${crypto.randomUUID().slice(0, 8)}@example.com`
  const db = createDb(databaseUrl)
  try {
    const health = await call('GET', '/api/health')
    check(health.status === 200 && health.json?.ok === true, 'health', health)
    check((await call('GET', '/api/me')).status === 401, 'signed out /api/me is 401')
    const signUp = await call('POST', '/api/auth/sign-up/email', { email, password: 'index-check-password', name: 'Index Check' })
    check(signUp.status === 200 && !!cookie, 'sign-up', signUp)

    const me = await call('GET', '/api/me')
    check(me.status === 200, '/api/me', me)
    check(me.json?.adzuna === false && me.json?.aiKey === null, 'optional features report off', { adzuna: me.json?.adzuna, aiKey: me.json?.aiKey })
    for (const path of ['/api/vacancies', '/api/vacancies/facets', '/api/jobs', '/api/searches', '/api/contacted']) {
      const r = await call('GET', path)
      check(r.status === 200, path, r.status)
    }

    // The hosted feed is capped per account per day, and a list goes no deeper than MAX_OFFSET.
    check((await call('GET', `/api/vacancies?offset=${MAX_OFFSET + 30}`)).status === 400, 'offset past MAX_OFFSET is 400')
    const [user] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email))
    await db.update(schema.feedDay).set({ pages: FEED_DAILY_PAGES }).where(eq(schema.feedDay.userId, user!.id))
    const capped = await call('GET', '/api/vacancies')
    check(capped.status === 429 && capped.json?.error === FEED_CAP_MESSAGE, 'feed page past the daily cap', capped)
    check((await feedCapDays(db)).get(user!.id) === 1, 'a capped day counts once for /admin')
    // Admins are exempt.
    await db.update(schema.user).set({ isAdmin: true }).where(eq(schema.user.id, user!.id))
    ;(env as { ADMIN_EMAIL?: string }).ADMIN_EMAIL = email
    check((await call('GET', '/api/vacancies')).status === 200, 'admin past the daily cap')
    // An admin exports and deletes another account (a GDPR request by email): same export, same erasure, both logged.
    const other = crypto.randomUUID()
    await db.insert(schema.user).values({ id: other, name: 'Index Check Other', email: `index-check-other-${other.slice(0, 8)}@example.com` })
    await db.insert(schema.oauthConsent).values({ id: crypto.randomUUID(), clientId: 'index-check', userId: other, scopes: ['openid'] })
    files.set(`resumes/${other}.pdf`, '%PDF-1.7 other')
    const exported = await call('GET', `/api/admin/users/${other}/export`)
    check(exported.status === 200 && (exported.json?.user as { id?: string })?.id === other && !!exported.json?.resume, 'admin export', exported.status)
    // Credit adds up, on both the grant and the balance, and is logged too.
    for (const addCreditEur of [5, 2.5]) await call('PATCH', `/api/admin/users/${other}`, { addCreditEur })
    const [given] = await db.select({ granted: schema.user.creditGrantedEur, left: schema.user.creditEur }).from(schema.user).where(eq(schema.user.id, other))
    check(given?.granted === 7.5 && given?.left === 7.5, 'admin credit adds up', given)
    // A reset starts the account's free count for today again; the global count stays.
    const freeRow = () => ({ id: crypto.randomUUID(), userId: other, kind: 'job' as const, tokens: 100, costUsd: 0 })
    await db.insert(schema.usage).values([freeRow(), freeRow()])
    check((await spendToday(db, other)).mine === 2 && (await freeLimitToday(db, 2)).has(other), 'free actions today before a reset')
    check((await call('PATCH', `/api/admin/users/${other}`, { resetFreeLimit: true })).status === 200, 'admin reset of the free limit')
    const afterReset = await spendToday(db, other)
    check(afterReset.mine === 0 && afterReset.actions >= 2 && !(await freeLimitToday(db, 2)).has(other), 'a reset zeroes the account, not everyone', afterReset)
    await new Promise((r) => setTimeout(r, 5))
    await db.insert(schema.usage).values(freeRow())
    check((await spendToday(db, other)).mine === 1, 'actions after a reset count again')
    check((await call('DELETE', `/api/admin/users/${user!.id}`)).status === 400, 'admin cannot delete an admin account here')
    check((await call('DELETE', `/api/admin/users/${other}`)).status === 200, 'admin delete')
    check(!files.has(`resumes/${other}.pdf`), 'admin delete removes the CV PDF')
    const [left] = await db.select({ n: sql<number>`(select count(*) from "user" where id = ${other}) + (select count(*) from oauth_consent where user_id = ${other})` }).from(sql`(select 1) one`)
    check(Number(left?.n) === 0, 'admin delete leaves no user or OAuth rows', left)
    const log = await db.select({ action: schema.adminAction.action }).from(schema.adminAction).where(eq(schema.adminAction.targetId, other))
    check(log.map((l) => l.action).sort().join() === 'credit,credit,delete,export,reset', 'admin export, credit, reset and delete are logged', log)
    const listed = ((await call('GET', '/api/admin/actions')).json?.actions as Array<{ targetId: string; admin: string | null; target: string | null }> | undefined)?.filter((a) => a.targetId === other)
    check(listed?.length === 5 && listed.every((a) => a.admin && a.target === null), "/admin lists the log, without a deleted account's email", listed)
    // The daily cron keeps the log 2 years.
    await db.insert(schema.adminAction).values({ id: crypto.randomUUID(), adminId: user!.id, action: 'export', targetId: other, createdAt: sql`now() - interval '2 years 1 day'` })
    await pruneAdminActions(db)
    check((await db.select({ id: schema.adminAction.id }).from(schema.adminAction).where(eq(schema.adminAction.targetId, other))).length === 5, 'pruneAdminActions keeps 2 years')
    await db.delete(schema.adminAction).where(eq(schema.adminAction.targetId, other))
    // A live switch overrides wrangler.jsonc's var on the next request, says who set it, and DELETE restores the default.
    const [taken] = await db.select().from(schema.setting).where(eq(schema.setting.key, 'FREE_DAILY_ACTIONS_ALL'))
    if (!taken) try {
      const cap = async () => ((await call('GET', '/api/admin/users')).json?.today as { actionsCap?: number })?.actionsCap
      const before = await cap()
      check((await call('PUT', '/api/admin/settings/FREE_DAILY_ACTIONS_ALL', { value: 1.5 })).status === 400, 'switch: whole actions only')
      check((await call('PUT', '/api/admin/settings/DATABASE_URL', { value: 1 })).status === 404, 'switch: only the listed keys')
      check((await call('PUT', '/api/admin/settings/FREE_DAILY_ACTIONS_ALL', { value: 7 })).status === 200, 'switch set')
      check((await cap()) === 7, 'switch applies at once', await cap())
      const listed = ((await call('GET', '/api/admin/settings')).json?.switches as Array<{ key: string; value: string; changedBy: string | null }>).find((s) => s.key === 'FREE_DAILY_ACTIONS_ALL')
      check(listed?.value === '7' && listed.changedBy === 'Index Check', 'switch lists value and who changed it', listed)
      check((await call('DELETE', '/api/admin/settings/FREE_DAILY_ACTIONS_ALL')).status === 200 && (await cap()) === before, 'switch back to the default')
    } finally {
      await db.delete(schema.setting).where(eq(schema.setting.key, 'FREE_DAILY_ACTIONS_ALL'))
    }
    delete (env as { ADMIN_EMAIL?: string }).ADMIN_EMAIL
    // The daily cron keeps 30 days of counts.
    await db.insert(schema.feedDay).values([{ userId: user!.id, day: sql`current_date - 30`, pages: 1 }, { userId: user!.id, day: sql`current_date - 31`, pages: 1 }])
    await pruneFeedDays(db)
    const kept = await db.select({ day: schema.feedDay.day }).from(schema.feedDay).where(eq(schema.feedDay.userId, user!.id))
    check(kept.length === 2, 'pruneFeedDays keeps 30 days', kept)
    // A day counts toward the free AI limit only with enough actions on this server's key (own-key rows book no tokens).
    const row = (tokens: number) => ({ id: crypto.randomUUID(), userId: user!.id, kind: 'job' as const, tokens, costUsd: 0 })
    await db.insert(schema.usage).values([row(100), row(0), row(0)])
    check(!(await freeLimitDays(db, 2)).has(user!.id), 'own-key actions are not free-limit hits')
    await db.insert(schema.usage).values(row(100))
    check((await freeLimitDays(db, 2)).get(user!.id) === 1, 'a day at the free limit counts once for /admin')
    check((await spendThisMonth(db, user!.id)).get(user!.id)?.actions === 4, 'actions this month')

    // No OPENROUTER_API_KEY and no own key: the model route explains itself instead of crashing.
    const extract = await call('POST', '/api/profile/extract', { text: 'Synthetic résumé for the boot check. '.repeat(8) })
    check(extract.status === 502 && String(extract.json?.error).startsWith('Connect your AI key'), 'résumé read without any AI key', extract)
    // No EXA_API_KEY: people search says it is off.
    const linkedin = await call('POST', '/api/profile/extract', { linkedin: 'https://www.linkedin.com/in/index-check-example' })
    check(String(linkedin.json?.error).includes('EXA_API_KEY'), 'LinkedIn read without EXA_API_KEY', linkedin)

    // Delete account: no row with the user's id in any table, and no CV PDF.
    const pdf = await worker.fetch(new Request('http://localhost/api/profile/resume', { method: 'PUT', headers: { origin: 'http://localhost', cookie, 'content-type': 'application/pdf', 'content-length': '13' }, body: '%PDF-1.7 test' }) as never, env, ctx)
    check(pdf.status === 200 && files.has(`resumes/${user!.id}.pdf`), 'CV upload', pdf.status)
    const token = { clientId: 'index-check', userId: user!.id, expiresAt: new Date(Date.now() + 3600_000), scopes: ['openid'] }
    await db.insert(schema.oauthConsent).values({ id: crypto.randomUUID(), clientId: 'index-check', userId: user!.id, scopes: ['openid'] })
    await db.insert(schema.oauthAccessToken).values({ id: crypto.randomUUID(), token: crypto.randomUUID(), ...token })
    await db.insert(schema.oauthRefreshToken).values({ id: crypto.randomUUID(), token: crypto.randomUUID(), ...token })
    const deleted = await call('POST', '/api/auth/delete-user', {})
    check(deleted.status === 200, 'delete account', deleted)
    check(!files.has(`resumes/${user!.id}.pdf`), 'CV PDF deleted with the account')
    for (const t of [{ name: 'user', column: 'id' }, ...userTables.map((t) => ({ name: t.name, column: 'user_id' }))]) {
      const { rows } = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${sql.identifier(t.name)} where ${sql.identifier(t.column)} = ${user!.id}`)
      check(rows[0]?.n === 0, `${t.name} rows left after delete account`, rows[0]?.n)
    }
    console.log('index ok')
  } finally {
    await db.delete(schema.user).where(eq(schema.user.email, email))
    // The OAuth rows have no foreign key, so a failed run would leave the check's fake client tokens behind.
    for (const t of [schema.oauthConsent, schema.oauthAccessToken, schema.oauthRefreshToken]) await db.delete(t).where(eq(t.clientId, 'index-check'))
  }
}
