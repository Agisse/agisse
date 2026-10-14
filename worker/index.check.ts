// Run: npx tsx worker/index.check.ts (CI: app shell only), or npx tsx --env-file=.env worker/index.check.ts
// Boots the Worker with only the required secrets, so every optional key is missing, and hits the main routes.
// With a DATABASE_URL it signs up a synthetic user on that (development) database and deletes it afterwards.
import { readFileSync } from 'node:fs'
import { eq, sql } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import worker from './index.ts'
import { createDb, schema } from './db/index.ts'
import { FEED_CAP_MESSAGE, FEED_DAILY_PAGES, feedCapDays, MAX_OFFSET, pruneFeedDays } from './lib/vacancies.ts'

const check = (ok: boolean, what: string, got?: unknown) => { if (!ok) throw new Error(`${what}${got === undefined ? '' : `: got ${JSON.stringify(got)}`}`) }

const vars = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, '')).vars as Record<string, string>
const databaseUrl = process.env.DATABASE_URL
const files = new Map<string, unknown>()
const RESUMES = { put: async (key: string, body: unknown) => void files.set(key, body), delete: async (key: string) => void files.delete(key) }
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
    delete (env as { ADMIN_EMAIL?: string }).ADMIN_EMAIL
    // The daily cron keeps 30 days of counts.
    await db.insert(schema.feedDay).values([{ userId: user!.id, day: sql`current_date - 30`, pages: 1 }, { userId: user!.id, day: sql`current_date - 31`, pages: 1 }])
    await pruneFeedDays(db)
    const kept = await db.select({ day: schema.feedDay.day }).from(schema.feedDay).where(eq(schema.feedDay.userId, user!.id))
    check(kept.length === 2, 'pruneFeedDays keeps 30 days', kept)

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
